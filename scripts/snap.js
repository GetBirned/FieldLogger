// Dev tool: renders the UI in Electron with throwaway sample data and saves
// screenshots to .snaps/. Uses a temp profile folder, never your real data.
//   npx electron scripts/snap.js [names...]
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

app.setPath('userData', path.join(os.tmpdir(), `fieldlogger-snap-${Date.now()}`));
const outDir = path.join(__dirname, '..', '.snaps');
fs.mkdirSync(outDir, { recursive: true });
const only = process.argv.slice(2).filter((a) => !a.startsWith('-') && !a.endsWith('.js') && a !== '.');

const W = Number(process.env.SNAP_W) || 1440;
const H = Number(process.env.SNAP_H) || 900;

const setup = `(async () => {
  const p = await __fl.bridge.profiles.create({ name: 'Alex Morgan', role: 'Implementation Consultant', color: '#f97316' });
  await __fl.signIn(p);
  __fl.loadDemo();
  return true;
})()`;

const theme = (t) => `__fl.setSettings({ theme: '${t}' })`;
const ui = (patch) => `__fl.setUi(${JSON.stringify(patch)})`;
const firstClient = `__fl.setUi({ page: 'clients', clientId: __fl.session.get().data.clients[0].id })`;
const startTimer = `(() => { const d = __fl.session.get().data; __fl.startTimer({ typeId: 'call', clientId: d.clients[1].id, notes: '' });
  __fl.updateData((x) => ({ ...x, timer: { ...x.timer, start: new Date(Date.now() - 23 * 60000 - 14000).toISOString() } })); })()`;

// A generated headshot-style photo, and a white-on-transparent logo pushed
// through the real processLogo() (it should pick the dark plate).
const fakePhoto = `(async () => {
  const c = Object.assign(document.createElement('canvas'), { width: 400, height: 300 });
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 400, 300); g.addColorStop(0, '#fbbf24'); g.addColorStop(1, '#f97316');
  x.fillStyle = g; x.fillRect(0, 0, 400, 300);
  x.fillStyle = '#7c2d12'; x.beginPath(); x.arc(200, 120, 55, 0, 7); x.fill();
  x.beginPath(); x.ellipse(200, 290, 110, 90, 0, 0, 7); x.fill();
  const file = new File([await new Promise((r) => c.toBlob(r))], 'me.png', { type: 'image/png' });
  await __fl.updateProfile({ photo: await __fl.image.processPhoto(file) });
})()`;
const whiteLogo = `(async () => {
  const c = Object.assign(document.createElement('canvas'), { width: 500, height: 300 });
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(120, 230); x.lineTo(250, 70); x.lineTo(380, 230); x.closePath(); x.fill();
  x.fillRect(120, 245, 260, 14);
  const file = new File([await new Promise((r) => c.toBlob(r))], 'summit.png', { type: 'image/png' });
  const out = await __fl.image.processLogo(file);
  const d = __fl.session.get().data;
  __fl.updateClient(d.clients.find((k) => k.name.startsWith('Summit')).id, out);
  return out.logoBg;
})()`;
// Reports the computed accent colors so contrast fixes can be checked.
const probe = `(() => { const cs = getComputedStyle(document.documentElement);
  const nav = document.querySelector('.nav-item.is-active');
  return ['--accent', '--accent-2', '--accent-lift', '--accent-text'].map((k) => k + '=' + cs.getPropertyValue(k).trim()).join(' | ')
    + ' | nav text=' + (nav ? getComputedStyle(nav).color : '?'); })()`;
const clickEdit =`[...document.querySelectorAll('.hero-actions button')].find((b) => b.textContent.trim() === 'Edit').click()`;
const escape = `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`;

const shots = [
  { name: 'gate', before: null },
  { name: 'day-light', js: [setup, fakePhoto, whiteLogo, theme('light'), ui({ page: 'calendar', calView: 'day' })] },
  { name: 'week-light', js: [ui({ calView: 'week' })] },
  { name: 'month-light', js: [ui({ calView: 'month' })] },
  { name: 'log-light', js: [ui({ calView: 'day' }), `__fl.openLog({ typeId: 'call' })`] },
  { name: 'log-filled-light', js: [`__fl.closeLog()`, `__fl.openLog({ typeId: 'call', clientId: __fl.session.get().data.clients[0].id })`,
    `(() => { const t = document.querySelector('.log-form textarea'); t.value = 'Walked Jamie through the cost code import'; t.dispatchEvent(new Event('input', { bubbles: true })); })()`] },
  { name: 'clients-light', js: [`__fl.closeLog()`, ui({ page: 'clients', clientId: null })] },
  { name: 'client-detail-light', js: [firstClient] },
  { name: 'client-form-light', js: [clickEdit] },
  { name: 'settings-profile-light', js: [escape, ui({ page: 'settings', settingsTab: 'profile' })] },
  { name: 'notes-light', js: [ui({ page: 'notes', clientId: null })] },
  { name: 'settings-light', js: [ui({ page: 'settings', settingsTab: 'appearance' })] },
  { name: 'day-dark', js: [theme('dark'), startTimer, ui({ page: 'calendar', calView: 'day' })] },
  { name: 'week-dark', js: [ui({ calView: 'week' })] },
  { name: 'log-dark', js: [`__fl.openLog({ mode: 'range', dateKey: new Date().toISOString().slice(0,10), startMin: 600, endMin: 690 })`] },
  { name: 'notes-dark', js: [`__fl.closeLog()`, ui({ page: 'notes' })] },
  { name: 'clients-dark', js: [ui({ page: 'clients', clientId: null })] },
  { name: 'client-detail-dark', js: [firstClient] },
  { name: 'settings-types-dark', js: [ui({ page: 'settings', settingsTab: 'types' })] },
  { name: 'settings-notes-dark', js: [ui({ page: 'settings', settingsTab: 'notes' })] },
  { name: 'accent-teal-dark', js: [`__fl.setSettings({ accent: '#14b8a6' })`, ui({ page: 'calendar', calView: 'day' })] },
  { name: 'brand-settings-light', js: [theme('light'), `__fl.setSettings({ accent: '#0063a3', accent2: '#004f83', darkStyle: 'trimble' })`, ui({ page: 'settings', settingsTab: 'appearance' })] },
  { name: 'trimble-dark-day', js: [theme('dark'), ui({ page: 'calendar', calView: 'day' }), probe] },
  { name: 'trimble-dark-notes', js: [ui({ page: 'notes' })] },
  { name: 'b2w-light-day', js: [theme('light'), `__fl.setSettings({ accent: '#982017', accent2: '#7a0b0a', darkStyle: 'midnight' })`, ui({ page: 'calendar' }), probe] },
  { name: 'b2w-dark-week', js: [theme('dark'), ui({ calView: 'week' }), probe] },
  { name: 'yellow-light-notes', js: [theme('light'), `__fl.setSettings({ accent: '#fbad26', accent2: '#f0920e' })`, ui({ page: 'notes' }), probe] },
  { name: 'gate-pin-dark', js: [`__fl.setProfilePin('2468')`, `__fl.lock()`] },
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: W, height: H, show: false, useContentSize: true, backgroundColor: '#f4f5f8', webPreferences: { backgroundThrottling: false } });
  win.webContents.on('console-message', (e) => {
    const { level, message, lineNumber, sourceId } = e;
    if (level === 'error' || level === 'warning' || level === 3 || level === 2) console.log(`[renderer ${level}] ${message} (${path.basename(sourceId || '')}:${lineNumber})`);
  });
  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'), { search: 'debug=1' });
  // Hidden windows run animations unpredictably; freeze them so shots show the end state.
  await win.webContents.insertCSS('*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important}');
  await wait(900);
  for (const shot of shots) {
    for (const js of shot.js || []) {
      try {
        const result = await win.webContents.executeJavaScript(js);
        if (typeof result === 'string') console.log(`[${shot.name}] -> ${result}`);
      } catch (err) { console.log(`[${shot.name}] script error: ${err.message}`); }
      await wait(150);
    }
    await wait(700);
    if (only.length && !only.includes(shot.name)) continue;
    // A hidden window paints lazily: the first capture flushes the pending frame.
    await win.webContents.capturePage();
    await wait(250);
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(outDir, `${shot.name}.png`), img.toPNG());
    console.log(`saved ${shot.name}.png ${img.getSize().width}x${img.getSize().height}`);
  }
  app.quit();
});
