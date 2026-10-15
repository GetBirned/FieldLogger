// FieldLogger - Electron main process.
// Owns the window, the on-disk data store and everything the renderer is not
// allowed to touch directly (file system, dialogs, clipboard, shell).
const { app, BrowserWindow, ipcMain, nativeTheme, shell, dialog, clipboard, Menu, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const { spawn } = require('child_process');

const APP_NAME = 'FieldLogger';
// The data folder name is pinned separately from the product name so a future
// rename never strands anyone's logs.
const DATA_FOLDER = 'FieldLogger';

app.setName(APP_NAME);
// FIELDLOGGER_USER_DATA points the app at a scratch folder (used by the self-test).
app.setPath('userData', process.env.FIELDLOGGER_USER_DATA || path.join(app.getPath('appData'), DATA_FOLDER));
if (process.platform === 'win32') app.setAppUserModelId('com.fieldlogger.app');

const DATA_DIR = path.join(app.getPath('userData'), 'data');
const PROFILE_DATA_DIR = path.join(DATA_DIR, 'profiles');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');
const WINDOW_STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');
const APP_STATE_FILE = path.join(app.getPath('userData'), 'app-state.json');
const BACKUPS_TO_KEEP = 14;
const UPDATE_SNAPSHOTS_TO_KEEP = 5;
const RESTORE_COPIES_TO_KEEP = 5;
// Prefix on the error a renderer gets when a data file exists but can't be read.
const UNREADABLE = 'FL_UNREADABLE';
const TITLEBAR_HEIGHT = 56;

for (const dir of [DATA_DIR, PROFILE_DATA_DIR, BACKUP_DIR]) fs.mkdirSync(dir, { recursive: true });

// ---------------------------------------------------------------- file helpers

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

// Write to a temp file then swap it in, so a crash mid-write never corrupts data.
function writeJsonAtomic(file, value) {
  const text = JSON.stringify(value, null, 2);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text, 'utf8');
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      fs.renameSync(tmp, file);
      return;
    } catch (err) {
      // Antivirus/indexers on Windows occasionally hold a lock for a moment.
      if (attempt === 3) {
        fs.writeFileSync(file, text, 'utf8');
        try { fs.unlinkSync(tmp); } catch {}
        return;
      }
      const until = Date.now() + 40;
      while (Date.now() < until) { /* brief spin before retrying */ }
    }
  }
}

const safeId = (id) => String(id || '').replace(/[^a-zA-Z0-9_-]/g, '');
const profileDataFile = (id) => path.join(PROFILE_DATA_DIR, `${safeId(id)}.json`);
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Keep one snapshot per profile per day (taken before the day's first save).
function dailyBackup(id) {
  const src = profileDataFile(id);
  if (!fs.existsSync(src)) return;
  const dest = path.join(BACKUP_DIR, `${safeId(id)}-${today()}.json`);
  if (fs.existsSync(dest)) return;
  try {
    fs.copyFileSync(src, dest);
    const mine = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith(`${safeId(id)}-`) && /\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort();
    for (const old of mine.slice(0, Math.max(0, mine.length - BACKUPS_TO_KEEP))) {
      fs.unlinkSync(path.join(BACKUP_DIR, old));
    }
  } catch (err) {
    console.error('Backup failed', err);
  }
}

// Read a JSON file, retrying briefly in case antivirus or an indexer holds it.
// Returns undefined if the file doesn't exist; throws if it exists but can't be read.
function readJsonStrict(file) {
  if (!fs.existsSync(file)) return undefined;
  let lastErr;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const value = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (value && typeof value === 'object') return value;
      lastErr = new Error('the file is empty or not FieldLogger data');
    } catch (err) {
      lastErr = err;
    }
    const until = Date.now() + 60;
    while (Date.now() < until) { /* brief spin before retrying */ }
  }
  throw lastErr;
}

const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15); // 20261014-213005

// Keep the newest `keep` entries in BACKUP_DIR whose names match, delete the rest.
function prune(match, keep) {
  try {
    const names = fs.readdirSync(BACKUP_DIR).filter(match).sort();
    for (const old of names.slice(0, Math.max(0, names.length - keep))) {
      fs.rmSync(path.join(BACKUP_DIR, old), { recursive: true, force: true });
    }
  } catch (err) {
    console.error('Pruning backups failed', err);
  }
}

// The first time a new version starts, copy all data aside before anything can read or
// migrate it, so a bad update is always one restore away from undone.
function snapshotBeforeUpdate() {
  const version = app.getVersion();
  const state = readJson(APP_STATE_FILE, {});
  if (state.lastVersion === version) return;
  try {
    const dataFiles = fs.readdirSync(PROFILE_DATA_DIR).filter((f) => f.endsWith('.json'));
    if (dataFiles.length || fs.existsSync(PROFILES_FILE)) {
      const dir = path.join(BACKUP_DIR, `pre-update-${stamp()}`);
      fs.mkdirSync(path.join(dir, 'profiles'), { recursive: true });
      if (fs.existsSync(PROFILES_FILE)) fs.copyFileSync(PROFILES_FILE, path.join(dir, 'profiles.json'));
      for (const f of dataFiles) fs.copyFileSync(path.join(PROFILE_DATA_DIR, f), path.join(dir, 'profiles', f));
      fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ from: state.lastVersion || null, to: version, at: new Date().toISOString() }, null, 2));
      prune((n) => n.startsWith('pre-update-'), UPDATE_SNAPSHOTS_TO_KEEP);
    }
    writeJsonAtomic(APP_STATE_FILE, { ...state, lastVersion: version });
  } catch (err) {
    // Leave lastVersion alone so the snapshot is tried again next launch.
    console.error('Pre-update snapshot failed', err);
  }
}

// -------------------------------------------------------------------- profiles

// A briefly locked or half-written file must never read as "no profiles",
// or the next write would drop everyone's profile. Retry, then fail loudly.
function loadProfiles() {
  if (!fs.existsSync(PROFILES_FILE)) return { version: 1, lastProfileId: null, profiles: [] };
  let lastErr;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const raw = JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf8'));
      if (raw && Array.isArray(raw.profiles)) return raw;
      lastErr = new Error('profiles.json has an unexpected shape');
    } catch (err) {
      lastErr = err;
    }
    const until = Date.now() + 60;
    while (Date.now() < until) { /* brief spin before retrying */ }
  }
  throw new Error(`Couldn't read the profile list (${lastErr?.message}). Nothing was changed.`);
}
const saveProfiles = (store) => writeJsonAtomic(PROFILES_FILE, store);

const publicProfile = (p) => ({
  id: p.id,
  name: p.name,
  role: p.role || '',
  color: p.color,
  photo: p.photo || null,
  createdAt: p.createdAt,
  lastOpenedAt: p.lastOpenedAt || null,
  hasPin: Boolean(p.pin),
  pinOnLaunch: p.pinOnLaunch !== false,
});

// Profile photos arrive as small, already-resized data URLs from the renderer.
const validPhoto = (photo) => typeof photo === 'string'
  && photo.length <= 800000
  && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(photo);

function hashPin(pin, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(String(pin), salt, 32).toString('hex') };
}
function pinMatches(stored, pin) {
  if (!stored) return true;
  const { hash } = hashPin(pin, stored.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(stored.hash, 'hex'));
}

const validPin = (pin) => typeof pin === 'string' && /^\d{4,8}$/.test(pin);

// Safety net: a profile data file that isn't in profiles.json (for example
// after an interrupted write) is re-registered as "Recovered profile" so its
// logs are never stranded. If it was saved more recently than the last-used
// profile, it becomes the last-used one so the app reopens into it.
function adoptOrphans(store) {
  const known = new Set(store.profiles.map((p) => p.id));
  const mtime = (id) => {
    try { return fs.statSync(profileDataFile(id)).mtimeMs; } catch { return 0; }
  };
  let changed = false;
  let lastTime = store.lastProfileId ? mtime(store.lastProfileId) : 0;
  for (const name of fs.readdirSync(PROFILE_DATA_DIR)) {
    const id = name.replace(/\.json$/, '');
    if (!name.endsWith('.json') || id !== safeId(id) || known.has(id)) continue;
    const data = readJson(path.join(PROFILE_DATA_DIR, name), null);
    if (!data || !((data.entries || []).length || (data.clients || []).length)) continue;
    const time = mtime(id);
    store.profiles.push({
      id,
      name: 'Recovered profile',
      role: '',
      color: '#64748b',
      photo: null,
      createdAt: new Date(time || Date.now()).toISOString(),
      lastOpenedAt: null,
      pin: null,
      pinOnLaunch: true,
      recovered: true,
    });
    if (time > lastTime) {
      store.lastProfileId = id;
      lastTime = time;
    }
    changed = true;
  }
  if (changed) saveProfiles(store);
  return store;
}

ipcMain.handle('profiles:list', () => {
  const store = adoptOrphans(loadProfiles());
  return { lastProfileId: store.lastProfileId, profiles: store.profiles.map(publicProfile) };
});

ipcMain.handle('profiles:create', (_e, input) => {
  const name = String(input?.name || '').trim().slice(0, 60);
  if (!name) throw new Error('A name is required.');
  const store = loadProfiles();
  const profile = {
    id: `p${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`,
    name,
    role: String(input?.role || '').trim().slice(0, 80),
    color: String(input?.color || '#f97316'),
    photo: validPhoto(input?.photo) ? input.photo : null,
    createdAt: new Date().toISOString(),
    lastOpenedAt: null,
    pin: validPin(input?.pin) ? hashPin(input.pin) : null,
    pinOnLaunch: true,
  };
  store.profiles.push(profile);
  saveProfiles(store);
  return publicProfile(profile);
});

ipcMain.handle('profiles:update', (_e, id, patch) => {
  const store = loadProfiles();
  const p = store.profiles.find((x) => x.id === id);
  if (!p) throw new Error('Profile not found.');
  if (typeof patch?.name === 'string' && patch.name.trim()) p.name = patch.name.trim().slice(0, 60);
  if (typeof patch?.role === 'string') p.role = patch.role.trim().slice(0, 80);
  if (typeof patch?.color === 'string') p.color = patch.color;
  if (patch && 'photo' in patch) {
    if (patch.photo === null) p.photo = null;
    else if (validPhoto(patch.photo)) p.photo = patch.photo;
    else throw new Error('That photo could not be saved.');
  }
  if (typeof patch?.pinOnLaunch === 'boolean') p.pinOnLaunch = patch.pinOnLaunch;
  saveProfiles(store);
  return publicProfile(p);
});

ipcMain.handle('profiles:setPin', (_e, id, pin) => {
  const store = loadProfiles();
  const p = store.profiles.find((x) => x.id === id);
  if (!p) throw new Error('Profile not found.');
  if (pin === null) p.pin = null;
  else if (validPin(pin)) p.pin = hashPin(pin);
  else throw new Error('PIN must be 4 to 8 digits.');
  saveProfiles(store);
  return publicProfile(p);
});

ipcMain.handle('profiles:verifyPin', (_e, id, pin) => {
  const p = loadProfiles().profiles.find((x) => x.id === id);
  if (!p) return false;
  try {
    return pinMatches(p.pin, pin);
  } catch {
    return false;
  }
});

ipcMain.handle('profiles:touch', (_e, id) => {
  const store = loadProfiles();
  const p = store.profiles.find((x) => x.id === id);
  if (!p) return null;
  p.lastOpenedAt = new Date().toISOString();
  store.lastProfileId = id;
  saveProfiles(store);
  return publicProfile(p);
});

ipcMain.handle('profiles:forget', () => {
  const store = loadProfiles();
  store.lastProfileId = null;
  saveProfiles(store);
  return true;
});

// Deleting a profile moves its data into backups instead of erasing it.
ipcMain.handle('profiles:remove', (_e, id) => {
  const store = loadProfiles();
  store.profiles = store.profiles.filter((x) => x.id !== id);
  if (store.lastProfileId === id) store.lastProfileId = null;
  saveProfiles(store);
  const file = profileDataFile(id);
  if (fs.existsSync(file)) {
    fs.renameSync(file, path.join(BACKUP_DIR, `deleted-${safeId(id)}-${Date.now()}.json`));
  }
  return true;
});

// ------------------------------------------------------------------------ data

// Profiles whose data file exists but couldn't be read. Saving to them is refused until a
// backup is restored, so an unreadable file is never replaced with an empty profile.
const unreadable = new Set();
// Data version last read or written per profile. A save with an older version is refused,
// so an older FieldLogger can't overwrite data a newer one saved.
const fileVersion = new Map();

ipcMain.handle('data:load', (_e, id) => {
  try {
    const data = readJsonStrict(profileDataFile(id));
    unreadable.delete(id);
    if (data === undefined) return null;
    fileVersion.set(id, Number(data.version) || 1);
    return data;
  } catch (err) {
    unreadable.add(id);
    throw new Error(`${UNREADABLE}: ${err.message}`);
  }
});

function checkSave(id, data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.entries) || !Array.isArray(data.clients)) {
    throw new Error('Refusing to save data that is missing its clients or entries.');
  }
  if (unreadable.has(id)) throw new Error(`${UNREADABLE}: restore a backup before saving.`);
  const incoming = Number(data.version) || 1;
  if (incoming < (fileVersion.get(id) || 0)) {
    throw new Error('This data was saved by a newer version of FieldLogger. Install the latest version to keep editing.');
  }
}

// Before each save, keep the version it replaces as "<id>-previous.json".
function keepPrevious(id) {
  const file = profileDataFile(id);
  if (!fs.existsSync(file)) return;
  try {
    fs.copyFileSync(file, path.join(BACKUP_DIR, `${safeId(id)}-previous.json`));
  } catch (err) {
    console.error('Keeping the previous save failed', err);
  }
}

function saveProfileData(id, data) {
  checkSave(id, data);
  dailyBackup(id);
  keepPrevious(id);
  writeJsonAtomic(profileDataFile(id), data);
  fileVersion.set(id, Number(data.version) || 1);
}

ipcMain.handle('data:save', (_e, id, data) => {
  saveProfileData(id, data);
  return true;
});

// Used on window close so the last edit is never lost.
ipcMain.on('data:saveSync', (e, id, data) => {
  try {
    saveProfileData(id, data);
    e.returnValue = true;
  } catch (err) {
    console.error(err);
    e.returnValue = false;
  }
});

// ---------------------------------------------------------------------- backups

// Every restorable copy of one profile's data, newest first. `key` is the path inside
// BACKUP_DIR; restore only accepts keys this function returns.
function listBackups(id) {
  const sid = safeId(id);
  const found = [];
  const add = (key, kind, label, at) => {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, key), 'utf8'));
      if (!data || !Array.isArray(data.entries) || !Array.isArray(data.clients)) return;
      found.push({ key, kind, label, at, clients: data.clients.length, entries: data.entries.length, version: Number(data.version) || 1 });
    } catch { /* unreadable copies aren't offered */ }
  };
  const mtime = (key) => fs.statSync(path.join(BACKUP_DIR, key)).mtime.toISOString();
  for (const name of fs.readdirSync(BACKUP_DIR)) {
    if (name === `${sid}-previous.json`) add(name, 'previous', 'Before the last save', mtime(name));
    else if (name.startsWith(`${sid}-before-restore-`) && name.endsWith('.json')) add(name, 'restore', 'Before a restore', mtime(name));
    else if (new RegExp(`^${sid}-\\d{4}-\\d{2}-\\d{2}\\.json$`).test(name)) add(name, 'daily', 'Daily copy', mtime(name));
    else if (name.startsWith('pre-update-')) {
      const key = `${name}/profiles/${sid}.json`;
      if (!fs.existsSync(path.join(BACKUP_DIR, key))) continue;
      const meta = readJson(path.join(BACKUP_DIR, name, 'meta.json'), {});
      const label = meta.from ? `Before updating ${meta.from} → ${meta.to}` : `Before updating to ${meta.to || 'a new version'}`;
      add(key, 'update', label, meta.at || mtime(key));
    }
  }
  return found.sort((a, b) => b.at.localeCompare(a.at));
}

ipcMain.handle('backups:list', (_e, id) => listBackups(id));

// Restores a backup over the profile's data. The current file is kept first: as a
// "before restore" copy if it's readable, or set aside as "unreadable" if it isn't.
ipcMain.handle('backups:restore', (_e, id, key) => {
  const entry = listBackups(id).find((b) => b.key === key);
  if (!entry) throw new Error('That backup is no longer available.');
  const data = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, entry.key), 'utf8'));
  const file = profileDataFile(id);
  const sid = safeId(id);
  if (fs.existsSync(file)) {
    let readable = true;
    try { readJsonStrict(file); } catch { readable = false; }
    if (readable) {
      fs.copyFileSync(file, path.join(BACKUP_DIR, `${sid}-before-restore-${stamp()}.json`));
      prune((n) => n.startsWith(`${sid}-before-restore-`), RESTORE_COPIES_TO_KEEP);
    } else {
      fs.renameSync(file, path.join(BACKUP_DIR, `${sid}-unreadable-${stamp()}.json`));
    }
  }
  writeJsonAtomic(file, data);
  unreadable.delete(id);
  fileVersion.set(id, Number(data.version) || 1);
  return true;
});

ipcMain.handle('data:export', async (e, data, suggestedName) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Export FieldLogger backup',
    defaultPath: path.join(app.getPath('documents'), suggestedName || 'FieldLogger-backup.json'),
    filters: [{ name: 'FieldLogger backup', extensions: ['json'] }],
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  return filePath;
});

ipcMain.handle('data:import', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Import FieldLogger backup',
    properties: ['openFile'],
    filters: [{ name: 'FieldLogger backup', extensions: ['json'] }],
  });
  if (canceled || !filePaths?.[0]) return null;
  return JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
});

ipcMain.handle('data:exportText', async (e, text, suggestedName) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Export',
    defaultPath: path.join(app.getPath('documents'), suggestedName || 'FieldLogger-export.csv'),
    filters: [{ name: 'CSV', extensions: ['csv'] }, { name: 'Text', extensions: ['txt'] }],
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, text, 'utf8');
  return filePath;
});

// --------------------------------------------------------------------- updates
// New versions are published to a shared folder (see scripts/publish-update.js) as
// FieldLogger-Setup-<version>.exe plus latest.json { version, file, sha256, notes }.
// The folder comes from Settings, falling back to the one built into package.json.

const BUILT_IN_UPDATE_FOLDER = (() => {
  try { return require('./package.json').fieldlogger?.updateFolder || ''; } catch { return ''; }
})();
const INSTALLER_NAME = /^FieldLogger-Setup-\d+\.\d+\.\d+\.exe$/;

const updateFolder = () => readJson(APP_STATE_FILE, {}).updateFolder || BUILT_IN_UPDATE_FOLDER;

function newerThan(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
}

// Network folders can hang for a long time when offline, so give up after a few seconds.
const withTimeout = (promise, ms, what) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(`${what} took too long`)), ms)),
]);

async function readLatest(folder) {
  const raw = await withTimeout(fs.promises.readFile(path.join(folder, 'latest.json'), 'utf8'), 8000, 'Reaching the update folder');
  const latest = JSON.parse(raw);
  if (!latest || typeof latest.version !== 'string' || !INSTALLER_NAME.test(String(latest.file)) || !/^[a-f0-9]{64}$/.test(String(latest.sha256))) {
    throw new Error("The update folder's latest.json is incomplete.");
  }
  return latest;
}

ipcMain.handle('updates:config', () => ({
  folder: updateFolder(),
  builtIn: BUILT_IN_UPDATE_FOLDER,
  custom: Boolean(readJson(APP_STATE_FILE, {}).updateFolder),
  version: app.getVersion(),
}));

// folder: a path to use, '' to go back to the built-in folder, or undefined to pick one in a dialog.
ipcMain.handle('updates:setFolder', async (e, folder) => {
  let chosen = folder;
  if (chosen === undefined) {
    const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), {
      title: 'Choose the FieldLogger update folder',
      properties: ['openDirectory'],
    });
    if (canceled || !filePaths?.[0]) return null;
    chosen = filePaths[0];
  }
  if (chosen && !fs.existsSync(chosen)) throw new Error("That folder doesn't exist.");
  writeJsonAtomic(APP_STATE_FILE, { ...readJson(APP_STATE_FILE, {}), updateFolder: chosen || undefined });
  return updateFolder();
});

// { status: 'not-configured' | 'unreachable' | 'current' | 'available', version, notes, error }
ipcMain.handle('updates:check', async () => {
  const folder = updateFolder();
  if (!folder) return { status: 'not-configured' };
  try {
    const latest = await readLatest(folder);
    if (!newerThan(latest.version, app.getVersion())) return { status: 'current', version: latest.version };
    return { status: 'available', version: latest.version, date: latest.date || null, notes: latest.notes || null };
  } catch (err) {
    return { status: 'unreachable', error: err.message };
  }
});

// Copies the installer locally, checks it against latest.json's SHA-256, then quits and
// runs it silently and reopens FieldLogger once it finishes. The renderer saves first.
ipcMain.handle('updates:install', async () => {
  const folder = updateFolder();
  if (!folder) throw new Error('No update folder is set.');
  const latest = await readLatest(folder);
  if (!newerThan(latest.version, app.getVersion())) throw new Error('You already have the latest version.');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fieldlogger-update-'));
  const local = path.join(dir, latest.file);
  await withTimeout(fs.promises.copyFile(path.join(folder, latest.file), local), 120000, 'Copying the installer');
  const hash = crypto.createHash('sha256').update(fs.readFileSync(local)).digest('hex');
  if (hash !== latest.sha256) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw new Error("The installer in the update folder doesn't match its checksum (it may still be copying). Nothing was installed. Try again in a minute.");
  }
  if (process.env.FIELDLOGGER_SELFTEST) return 'verified';
  // Wait for this app to exit so the installer can replace its files, install silently, then
  // reopen this same exe. (The installer's own --force-run opens a Start menu shortcut that may
  // not exist yet at that moment.) Verbatim so cmd sees the quoted paths as-is: Node's default
  // escaping uses \" which cmd doesn't understand.
  const relaunch = app.isPackaged ? ` & start "" "${process.execPath}"` : '';
  spawn('cmd.exe', ['/c', `timeout /t 2 /nobreak >nul & start "" /wait "${local}" /S${relaunch}`], {
    detached: true, stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: true,
  }).unref();
  setTimeout(() => app.quit(), 300);
  return 'installing';
});

// ------------------------------------------------------------------------- app

ipcMain.handle('app:info', () => ({
  version: app.getVersion(),
  dataDir: DATA_DIR,
  packaged: app.isPackaged,
}));

ipcMain.handle('app:openDataFolder', () => shell.openPath(DATA_DIR));

ipcMain.handle('app:openExternal', (_e, url) => {
  if (/^(https?:|mailto:|tel:)/i.test(String(url))) return shell.openExternal(String(url));
  return false;
});

ipcMain.handle('app:titleBar', (e, colors) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!win || process.platform !== 'win32') return false;
  try {
    win.setTitleBarOverlay({ color: colors.color, symbolColor: colors.symbolColor, height: TITLEBAR_HEIGHT });
    win.setBackgroundColor(colors.color);
  } catch {}
  return true;
});

ipcMain.handle('app:zoom', (e, factor) => {
  const f = Math.min(1.5, Math.max(0.75, Number(factor) || 1));
  e.sender.setZoomFactor(f);
  return f;
});

ipcMain.handle('clipboard:write', (_e, text) => {
  clipboard.writeText(String(text ?? ''));
  return true;
});

// ---------------------------------------------------------------------- window

let mainWindow = null;

function loadWindowState() {
  const s = readJson(WINDOW_STATE_FILE, {});
  return { width: s.width || 1440, height: s.height || 900, x: s.x, y: s.y, maximized: Boolean(s.maximized) };
}

// The saved spot may be on a monitor that's no longer connected. Keep it only if the title
// bar would be on a screen the user can see now; otherwise open centered, sized to fit.
function onScreen(state) {
  const { workArea: primary } = screen.getPrimaryDisplay();
  const size = { width: Math.min(state.width, primary.width), height: Math.min(state.height, primary.height) };
  if (!Number.isFinite(state.x) || !Number.isFinite(state.y)) return size;
  const visible = screen.getAllDisplays().some(({ workArea: a }) => state.x + size.width - 120 > a.x && state.x + 120 < a.x + a.width
    && state.y >= a.y - 10 && state.y + TITLEBAR_HEIGHT < a.y + a.height);
  return visible ? { ...size, x: state.x, y: state.y } : size;
}

// Bring the window back where it can be seen (restored, shown, on screen, focused).
function revealWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  if (!mainWindow.isMaximized()) {
    const fixed = onScreen(mainWindow.getBounds());
    if (fixed.x === undefined) {
      // Center on the main screen (center() would pick whichever screen is nearest).
      const a = screen.getPrimaryDisplay().workArea;
      mainWindow.setBounds({ ...fixed, x: Math.round(a.x + (a.width - fixed.width) / 2), y: Math.round(a.y + (a.height - fixed.height) / 2) });
    }
  }
  mainWindow.focus();
}
function saveWindowState(win) {
  if (!win || win.isDestroyed()) return;
  const maximized = win.isMaximized();
  const b = maximized ? loadWindowState() : win.getBounds();
  writeJsonAtomic(WINDOW_STATE_FILE, { width: b.width, height: b.height, x: b.x, y: b.y, maximized });
}

function createWindow() {
  const state = loadWindowState();
  const bounds = onScreen(state);
  const dark = nativeTheme.shouldUseDarkColors;
  const bg = dark ? '#0b0d12' : '#f4f5f8';

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 1080,
    minHeight: 680,
    show: false,
    title: APP_NAME,
    backgroundColor: bg,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: bg, symbolColor: dark ? '#c3c8d3' : '#3b4250', height: TITLEBAR_HEIGHT },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  if (state.maximized) mainWindow.maximize();
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.once('ready-to-show', () => {
    if (!process.env.FIELDLOGGER_SELFTEST) mainWindow.show();
  });
  // Never stay invisible: if the first paint is slow or stalls, show the window anyway.
  setTimeout(() => {
    if (!process.env.FIELDLOGGER_SELFTEST && mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) mainWindow.show();
  }, 5000);
  if (process.env.FIELDLOGGER_SELFTEST) runSelfTest(mainWindow);

  // Links (mailto:, tel:, websites) open outside the app; the app itself never navigates away.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?:|mailto:|tel:)/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url === mainWindow.webContents.getURL()) return;
    event.preventDefault();
    if (/^(https?:|mailto:|tel:)/i.test(url)) shell.openExternal(url);
  });

  // During development, surface renderer errors in the terminal.
  if (!app.isPackaged) {
    mainWindow.webContents.on('console-message', (e) => {
      if (e.level === 'error' || e.level === 'warning') console.log(`[renderer ${e.level}] ${e.message}`);
    });
  }

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const key = input.key.toLowerCase();
    if (key === 'f12' || (input.control && input.shift && key === 'i')) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    } else if (!app.isPackaged && input.control && key === 'r') {
      mainWindow.webContents.reload();
      event.preventDefault();
    }
  });

  let saveTimer = null;
  const queueStateSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveWindowState(mainWindow), 400);
  };
  mainWindow.on('resize', queueStateSave);
  mainWindow.on('move', queueStateSave);
  mainWindow.on('close', () => saveWindowState(mainWindow));
  mainWindow.on('closed', () => { mainWindow = null; });
}

// Exercises the real preload -> IPC -> disk path end to end, then quits.
//   set FIELDLOGGER_SELFTEST=1 and FIELDLOGGER_USER_DATA=<scratch folder>
function runSelfTest(win) {
  win.webContents.once('did-finish-load', async () => {
    const script = `(async () => {
      const api = window.fieldlogger, out = {};
      await new Promise((r) => setTimeout(r, 600));
      out.uiBooted = Boolean(document.querySelector('.gate, .shell'));
      const p = await api.profiles.create({ name: 'Self Test', role: 'QA', color: '#14b8a6', pin: '2468' });
      out.created = Boolean(p.id) && p.hasPin === true;
      out.pinRight = await api.profiles.verifyPin(p.id, '2468');
      out.pinWrong = (await api.profiles.verifyPin(p.id, '1111')) === false;
      const data = { version: 1, profileId: p.id, settings: { theme: 'dark' }, actionTypes: [], clients: [{ id: 'c1', name: 'Acme' }],
        entries: [{ id: 'e1', typeId: 'call', clientId: 'c1', start: new Date().toISOString(), end: null, minutes: 15, notes: 'hello' }], timer: null };
      out.saved = await api.data.save(p.id, data);
      const back = await api.data.load(p.id);
      out.roundTrip = JSON.stringify(back) === JSON.stringify(data);
      out.saveSync = api.data.saveSync(p.id, { ...data, entries: [] }) === true;
      out.syncPersisted = (await api.data.load(p.id)).entries.length === 0;
      await api.profiles.touch(p.id);
      const list = await api.profiles.list();
      out.listed = list.lastProfileId === p.id && list.profiles.length === 1 && !('pin' in list.profiles[0]);
      const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
      const q = await api.profiles.create({ name: 'Second', color: '#f97316', photo });
      out.secondKeepsFirst = (await api.profiles.list()).profiles.map((x) => x.id).join() === [p.id, q.id].join();
      out.photoOnCreate = q.photo === photo;
      out.photoCleared = (await api.profiles.update(q.id, { photo: null })).photo === null;
      out.badPhotoRejected = await api.profiles.update(q.id, { photo: 'javascript:alert(1)' }).then(() => false, () => true);
      out.pinOnLaunchToggle = (await api.profiles.update(p.id, { pinOnLaunch: false })).pinOnLaunch === false;
      await api.data.save('porphantest01', { ...data, profileId: 'porphantest01' });
      const after = await api.profiles.list();
      const adopted = after.profiles.find((x) => x.id === 'porphantest01');
      out.orphanAdopted = Boolean(adopted) && adopted.name === 'Recovered profile' && !adopted.hasPin && after.lastProfileId === 'porphantest01';
      await api.profiles.remove('porphantest01');
      await api.profiles.remove(q.id);
      await api.profiles.remove(p.id);
      out.removed = (await api.profiles.list()).profiles.length === 0;
      // Data safety: an unreadable file is never overwritten, and a backup restores it.
      const bad = 'pcorrupt01';
      out.unreadableLoadRefused = await api.data.load(bad).then(() => false, (e) => String(e.message).includes('${UNREADABLE}'));
      out.unreadableSaveRefused = await api.data.save(bad, { ...data, profileId: bad }).then(() => false, () => true);
      const daily = (await api.backups.list(bad)).find((b) => b.kind === 'daily');
      out.backupListed = Boolean(daily) && daily.clients === 1;
      out.restored = daily ? (await api.backups.restore(bad, daily.key)) === true && (await api.data.load(bad)).clients[0].name === 'Kept' : false;
      await api.data.save(bad, { ...data, profileId: bad, version: 99 });
      out.previousKept = (await api.backups.list(bad)).some((b) => b.kind === 'previous' && b.clients === 1);
      out.downgradeRefused = await api.data.save(bad, { ...data, profileId: bad, version: 1 }).then(() => false, () => true);
      out.emptySaveRefused = await api.data.save(bad, { version: 99 }).then(() => false, () => true);
      await api.profiles.remove(bad);
      // Update notices: newer versions are offered, older ignored, checksums enforced.
      const upd = ${JSON.stringify(path.join(app.getPath('userData'), 'update-test'))};
      await api.updates.setFolder(upd + '\\\\newer');
      const newer = await api.updates.check();
      out.updateOffered = newer.status === 'available' && newer.version === '99.0.0' && newer.notes.title === 'Test';
      out.updateVerified = (await api.updates.install()) === 'verified';
      await api.updates.setFolder(upd + '\\\\tampered');
      out.updateBadChecksumRefused = await api.updates.install().then(() => false, (e) => String(e.message).includes('checksum'));
      await api.updates.setFolder(upd + '\\\\older');
      out.updateOlderIgnored = (await api.updates.check()).status === 'current';
      await api.updates.setFolder('');
      out.updateFolderCleared = (await api.updates.config()).custom === false;
      return out;
    })()`;
    try {
      // Fake update folders: a newer release, the same with a wrong checksum, and an older one.
      const upd = path.join(app.getPath('userData'), 'update-test');
      const fakeExe = Buffer.from('not really an installer');
      const sha = crypto.createHash('sha256').update(fakeExe).digest('hex');
      for (const [dir, version, sha256] of [['newer', '99.0.0', sha], ['tampered', '99.0.0', 'f'.repeat(64)], ['older', '0.0.1', sha]]) {
        const file = `FieldLogger-Setup-${version}.exe`;
        fs.mkdirSync(path.join(upd, dir), { recursive: true });
        fs.writeFileSync(path.join(upd, dir, file), fakeExe);
        fs.writeFileSync(path.join(upd, dir, 'latest.json'), JSON.stringify({ version, file, sha256, notes: { title: 'Test', items: [] } }));
      }
      // A half-written data file plus a good daily copy of it, for the data-safety checks.
      fs.writeFileSync(profileDataFile('pcorrupt01'), '{"clients": [', 'utf8');
      writeJsonAtomic(path.join(BACKUP_DIR, 'pcorrupt01-2026-01-01.json'),
        { version: 1, profileId: 'pcorrupt01', settings: {}, actionTypes: [], clients: [{ id: 'c1', name: 'Kept' }], entries: [], timer: null });
      const result = await win.webContents.executeJavaScript(script);
      result.unreadableFileKept = fs.readdirSync(BACKUP_DIR).some((f) => f.startsWith('pcorrupt01-unreadable-'));
      const pass = Object.values(result).every(Boolean);
      console.log(`SELFTEST ${pass ? 'PASS' : 'FAIL'} ${JSON.stringify(result)}`);
      const backups = fs.readdirSync(BACKUP_DIR);
      console.log(`SELFTEST backups folder: ${backups.join(', ') || '(empty)'}`);
      app.exit(pass ? 0 : 1);
    } catch (err) {
      console.log(`SELFTEST ERROR ${err.message}`);
      app.exit(1);
    }
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // Opening FieldLogger again while it's running brings its window back into view.
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) createWindow();
    else revealWindow();
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    snapshotBeforeUpdate();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
