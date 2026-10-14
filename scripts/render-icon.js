// Rasterizes assets/logo.svg into assets/icon.png (512px) and a multi-size
// assets/icon.ico for Windows, using Electron's renderer.   npm run icon
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

app.setPath('userData', path.join(os.tmpdir(), 'fieldlogger-icon'));
app.disableHardwareAcceleration();

const assets = path.join(__dirname, '..', 'assets');
const svg = fs.readFileSync(path.join(assets, 'logo.svg'), 'utf8');
const SIZES = [16, 24, 32, 48, 64, 128, 256];

async function render(win, size) {
  const page = `<!doctype html><html><body style="margin:0;background:transparent;overflow:hidden">
    <div style="width:${size}px;height:${size}px">${svg.replace('<svg ', `<svg style="display:block;width:${size}px;height:${size}px" `)}</div></body></html>`;
  win.setContentSize(size, size);
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`);
  await new Promise((r) => setTimeout(r, 250));
  await win.webContents.capturePage();
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size });
  const { width } = img.getSize();
  return width === size ? img : img.resize({ width: size, height: size, quality: 'best' });
}

// ICO container holding PNG frames (supported since Windows Vista).
function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let offset = 6 + dir.length;
  pngs.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2);
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, dir, ...pngs.map((p) => p.data)]);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false, frame: false, transparent: true, useContentSize: true, width: 512, height: 512,
    webPreferences: { offscreen: true },
  });
  win.webContents.setFrameRate(30);

  const big = await render(win, 512);
  fs.writeFileSync(path.join(assets, 'icon.png'), big.toPNG());

  const frames = [];
  for (const size of SIZES) frames.push({ size, data: (await render(win, size)).toPNG() });
  fs.writeFileSync(path.join(assets, 'icon.ico'), buildIco(frames));
  console.log(`Wrote assets/icon.png and assets/icon.ico (${SIZES.join(', ')} px)`);
  app.quit();
});
