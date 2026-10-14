// Turns user-chosen image files into small data URLs that live inside the
// profile's JSON: client logos are trimmed and fit, profile photos are
// center-cropped squares. Everything happens locally on a canvas.

const MAX_BYTES = 20 * 1024 * 1024;
const LOGO_SIZE = 192;
const PHOTO_SIZE = 256;

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file doesn't look like an image."));
    img.src = src;
  });
}

async function decode(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error('Pick an image file (PNG, JPG, SVG, WebP or GIF).');
  if (file.size > MAX_BYTES) throw new Error('That image is over 20 MB. Try a smaller one.');
  const img = await loadImage(await readAsDataUrl(file));
  // SVGs without explicit dimensions report 0; give them a sensible canvas.
  const w = img.naturalWidth || 512;
  const h = img.naturalHeight || 512;
  return { img, w, h };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return [c, ctx];
}

function encode(c) {
  const webp = c.toDataURL('image/webp', 0.92);
  return webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/png');
}

// Bounding box of pixels that pass the test, or null if none do.
function bbox(data, w, h, keep) {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (keep(data[i], data[i + 1], data[i + 2], data[i + 3])) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * Client logo: trims empty margins (transparent, or white on opaque images),
 * fits it in 192px and picks a plate color so white logos stay visible.
 * Returns { logo, logoBg: 'light' | 'dark' }.
 */
export async function processLogo(file) {
  const { img, w, h } = await decode(file);
  const scan = Math.min(1, 640 / Math.max(w, h));
  const [sc, sctx] = canvas(w * scan, h * scan);
  sctx.drawImage(img, 0, 0, sc.width, sc.height);
  const { data } = sctx.getImageData(0, 0, sc.width, sc.height);

  const solid = (r, g, b, a) => a >= 16;
  const ink = (r, g, b, a) => a >= 16 && !(r > 242 && g > 242 && b > 242);
  const corners = [0, sc.width - 1, (sc.height - 1) * sc.width, sc.height * sc.width - 1].map((p) => data[p * 4 + 3]);
  const transparent = corners.filter((a) => a < 16).length >= 2;
  const box = (transparent ? bbox(data, sc.width, sc.height, solid) : bbox(data, sc.width, sc.height, ink) || bbox(data, sc.width, sc.height, solid))
    || { x: 0, y: 0, w: sc.width, h: sc.height };

  // Average brightness of the visible pixels decides the plate color.
  let lum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 16) {
    if (data[i + 3] < 16) continue;
    lum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    count += 1;
  }
  const logoBg = transparent && count && lum / count > 0.82 ? 'dark' : 'light';

  const fit = Math.min(1, LOGO_SIZE / Math.max(box.w / scan, box.h / scan));
  const [c, ctx] = canvas((box.w / scan) * fit, (box.h / scan) * fit);
  ctx.drawImage(img, box.x / scan, box.y / scan, box.w / scan, box.h / scan, 0, 0, c.width, c.height);
  return { logo: encode(c), logoBg };
}

/** Profile photo: center-cropped square, 256px. Returns a data URL. */
export async function processPhoto(file) {
  const { img, w, h } = await decode(file);
  const side = Math.min(w, h);
  const [c, ctx] = canvas(PHOTO_SIZE, PHOTO_SIZE);
  ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
  return encode(c);
}

/** Opens the system file picker for one image. Resolves to a File or null. */
export function chooseImage() {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*' });
    input.onchange = () => resolve(input.files?.[0] || null);
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

/** First image file in a paste or drop event, if any. */
export function imageFromTransfer(transfer) {
  if (!transfer) return null;
  const files = [...(transfer.files || [])];
  const fromItems = [...(transfer.items || [])].filter((i) => i.kind === 'file').map((i) => i.getAsFile()).filter(Boolean);
  return [...files, ...fromItems].find((f) => /^image\//.test(f.type)) || null;
}
