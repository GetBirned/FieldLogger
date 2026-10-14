// FieldLogger - Electron main process.
// Owns the window, the on-disk data store and everything the renderer is not
// allowed to touch directly (file system, dialogs, clipboard, shell).
const { app, BrowserWindow, ipcMain, nativeTheme, shell, dialog, clipboard, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

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
const BACKUPS_TO_KEEP = 14;
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

// -------------------------------------------------------------------- profiles

function loadProfiles() {
  const raw = readJson(PROFILES_FILE, null);
  if (!raw || !Array.isArray(raw.profiles)) return { version: 1, lastProfileId: null, profiles: [] };
  return raw;
}
const saveProfiles = (store) => writeJsonAtomic(PROFILES_FILE, store);

const publicProfile = (p) => ({
  id: p.id,
  name: p.name,
  role: p.role || '',
  color: p.color,
  createdAt: p.createdAt,
  lastOpenedAt: p.lastOpenedAt || null,
  hasPin: Boolean(p.pin),
});

function hashPin(pin, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(String(pin), salt, 32).toString('hex') };
}
function pinMatches(stored, pin) {
  if (!stored) return true;
  const { hash } = hashPin(pin, stored.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(stored.hash, 'hex'));
}

const validPin = (pin) => typeof pin === 'string' && /^\d{4,8}$/.test(pin);

ipcMain.handle('profiles:list', () => {
  const store = loadProfiles();
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
    createdAt: new Date().toISOString(),
    lastOpenedAt: null,
    pin: validPin(input?.pin) ? hashPin(input.pin) : null,
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

ipcMain.handle('data:load', (_e, id) => readJson(profileDataFile(id), null));

ipcMain.handle('data:save', (_e, id, data) => {
  dailyBackup(id);
  writeJsonAtomic(profileDataFile(id), data);
  return true;
});

// Used on window close so the last edit is never lost.
ipcMain.on('data:saveSync', (e, id, data) => {
  try {
    writeJsonAtomic(profileDataFile(id), data);
    e.returnValue = true;
  } catch (err) {
    console.error(err);
    e.returnValue = false;
  }
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
function saveWindowState(win) {
  if (!win || win.isDestroyed()) return;
  const maximized = win.isMaximized();
  const b = maximized ? loadWindowState() : win.getBounds();
  writeJsonAtomic(WINDOW_STATE_FILE, { width: b.width, height: b.height, x: b.x, y: b.y, maximized });
}

function createWindow() {
  const state = loadWindowState();
  const dark = nativeTheme.shouldUseDarkColors;
  const bg = dark ? '#0b0d12' : '#f4f5f8';

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
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
      await api.profiles.remove(p.id);
      out.removed = (await api.profiles.list()).profiles.length === 0;
      return out;
    })()`;
    try {
      const result = await win.webContents.executeJavaScript(script);
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
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
