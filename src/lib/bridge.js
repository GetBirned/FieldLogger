// Storage + OS bridge. Inside the desktop app this is the preload API (files on
// disk). In a plain browser (npm run preview) it falls back to localStorage so
// the UI can be developed and previewed without Electron.

const native = typeof window !== 'undefined' && window.fieldlogger && window.fieldlogger.isElectron
  ? window.fieldlogger
  : null;

const LS = 'fieldlogger:web:';
const lsGet = (k, fallback) => {
  try {
    const v = localStorage.getItem(LS + k);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
const lsSet = (k, v) => {
  try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch {}
};

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const pub = (p) => ({ id: p.id, name: p.name, role: p.role || '', color: p.color, createdAt: p.createdAt, lastOpenedAt: p.lastOpenedAt || null, hasPin: Boolean(p.pin) });
const getStore = () => lsGet('profiles', { lastProfileId: null, profiles: [] });

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const web = {
  isElectron: false,
  profiles: {
    async list() {
      const s = getStore();
      return { lastProfileId: s.lastProfileId, profiles: s.profiles.map(pub) };
    },
    async create(input) {
      const s = getStore();
      const p = {
        id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        name: String(input.name || '').trim(),
        role: String(input.role || '').trim(),
        color: input.color || '#f97316',
        createdAt: new Date().toISOString(),
        pin: input.pin ? await sha256(`fl:${input.pin}`) : null,
      };
      s.profiles.push(p);
      lsSet('profiles', s);
      return pub(p);
    },
    async update(id, patch) {
      const s = getStore();
      const p = s.profiles.find((x) => x.id === id);
      Object.assign(p, { name: patch.name ?? p.name, role: patch.role ?? p.role, color: patch.color ?? p.color });
      lsSet('profiles', s);
      return pub(p);
    },
    async setPin(id, pin) {
      const s = getStore();
      const p = s.profiles.find((x) => x.id === id);
      p.pin = pin ? await sha256(`fl:${pin}`) : null;
      lsSet('profiles', s);
      return pub(p);
    },
    async verifyPin(id, pin) {
      const p = getStore().profiles.find((x) => x.id === id);
      return Boolean(p) && (!p.pin || p.pin === (await sha256(`fl:${pin}`)));
    },
    async touch(id) {
      const s = getStore();
      const p = s.profiles.find((x) => x.id === id);
      if (!p) return null;
      p.lastOpenedAt = new Date().toISOString();
      s.lastProfileId = id;
      lsSet('profiles', s);
      return pub(p);
    },
    async forget() {
      const s = getStore();
      s.lastProfileId = null;
      lsSet('profiles', s);
      return true;
    },
    async remove(id) {
      const s = getStore();
      s.profiles = s.profiles.filter((x) => x.id !== id);
      if (s.lastProfileId === id) s.lastProfileId = null;
      lsSet('profiles', s);
      try { localStorage.removeItem(`${LS}data:${id}`); } catch {}
      return true;
    },
  },
  data: {
    async load(id) { return lsGet(`data:${id}`, null); },
    async save(id, data) { lsSet(`data:${id}`, data); return true; },
    saveSync(id, data) { lsSet(`data:${id}`, data); return true; },
    async exportFile(data, name) { download(name, JSON.stringify(data, null, 2), 'application/json'); return name; },
    async exportText(text, name) { download(name, text, 'text/csv'); return name; },
    importFile() {
      return new Promise((resolve, reject) => {
        const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json' });
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) return resolve(null);
          try { resolve(JSON.parse(await file.text())); } catch (e) { reject(e); }
        };
        input.click();
      });
    },
  },
  app: {
    async info() { return { version: 'preview', dataDir: 'Browser storage (preview mode)', packaged: false }; },
    async openDataFolder() { return false; },
    async openExternal(url) { window.open(url, '_blank'); return true; },
    async setTitleBar() { return false; },
    async setZoom() { return 1; },
  },
  clipboard: {
    async write(text) {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = Object.assign(document.createElement('textarea'), { value: text });
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      return true;
    },
  },
};

export const bridge = native || web;
export const isElectron = Boolean(native);
