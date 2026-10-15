// Trims the source images in erp_logos/ to their visible content and writes
// square, transparent 128px PNGs to assets/erp/ for the client ERP badges.
//   npm run erp-logos
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

app.setPath('userData', path.join(os.tmpdir(), 'fieldlogger-erp-logos'));
app.disableHardwareAcceleration();

const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'erp_logos');
const outDir = path.join(root, 'assets', 'erp');
const SIZE = 128;
const PAD = 6;

// Output name -> source file.
const LOGOS = {
  vista: 'vista.png',
  spectrum: 'spectrum_logo.png',
  sage: 'sage_logo.webp',
  quickbooks: 'quickbooks_logo.png',
  foundation: 'foundation_logo.png',
  computerease: 'computerEase.png',
};

// Runs in the page: draw the image, find the bounding box of visible pixels
// (not transparent and not near-white), and fit that box into a padded square.
const trimInPage = `async (url, size, pad) => {
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const { data, width, height } = x.getImageData(0, 0, c.width, c.height);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) for (let i = 0; i < width; i++) {
    const o = (y * width + i) * 4;
    const visible = data[o + 3] > 24 && !(data[o] > 240 && data[o + 1] > 240 && data[o + 2] > 240);
    if (visible) { if (i < minX) minX = i; if (i > maxX) maxX = i; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  if (maxX < 0) throw new Error('no visible pixels');
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const s = (size - pad * 2) / Math.max(w, h);
  const out = document.createElement('canvas');
  out.width = size; out.height = size;
  const o2 = out.getContext('2d');
  o2.imageSmoothingQuality = 'high';
  o2.drawImage(c, minX, minY, w, h, (size - w * s) / 2, (size - h * s) / 2, w * s, h * s);
  return out.toDataURL('image/png');
}`;

app.whenReady().then(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await win.loadURL('data:text/html,<!doctype html><title>erp</title>');
  for (const [name, file] of Object.entries(LOGOS)) {
    const buf = fs.readFileSync(path.join(srcDir, file));
    const mime = file.endsWith('.webp') ? 'image/webp' : 'image/png';
    const url = `data:${mime};base64,${buf.toString('base64')}`;
    const png = await win.webContents.executeJavaScript(`(${trimInPage})(${JSON.stringify(url)}, ${SIZE}, ${PAD})`);
    fs.writeFileSync(path.join(outDir, `${name}.png`), Buffer.from(png.split(',')[1], 'base64'));
    console.log(`assets/erp/${name}.png  <-  erp_logos/${file}`);
  }
  app.quit();
});
