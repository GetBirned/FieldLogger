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

const shots = [
  { name: 'gate', before: null },
  { name: 'day-light', js: [setup, theme('light'), ui({ page: 'calendar', calView: 'day' })] },
  { name: 'week-light', js: [ui({ calView: 'week' })] },
  { name: 'month-light', js: [ui({ calView: 'month' })] },
  { name: 'log-light', js: [ui({ calView: 'day' }), `__fl.openLog({ typeId: 'call' })`] },
  { name: 'log-filled-light', js: [`__fl.closeLog()`, `__fl.openLog({ typeId: 'call', clientId: __fl.session.get().data.clients[0].id })`,
    `(() => { const t = document.querySelector('.log-form textarea'); t.value = 'Walked Jamie through the cost code import'; t.dispatchEvent(new Event('input', { bubbles: true })); })()`] },
  { name: 'clients-light', js: [`__fl.closeLog()`, ui({ page: 'clients', clientId: null })] },
  { name: 'client-detail-light', js: [firstClient] },
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
      try { await win.webContents.executeJavaScript(js); } catch (err) { console.log(`[${shot.name}] script error: ${err.message}`); }
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
