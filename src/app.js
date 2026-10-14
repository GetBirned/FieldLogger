// Entry point: boots the profile session, applies the theme and wires global
// keyboard shortcuts and tooltips.
import { html, render, useEffect } from './lib/h.js';
import { bridge, isElectron } from './lib/bridge.js';
import * as store from './lib/store.js';
import * as image from './lib/image.js';
import { useSession, signIn, openLog, nav } from './lib/store.js';
import { DEFAULT_SETTINGS } from './lib/defaults.js';
import { ProfileGate } from './components/ProfileGate.js';
import { Shell } from './components/Shell.js';

const APPEARANCE_KEY = 'fieldlogger:appearance';
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function relLuminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return 0.3;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function readAppearance() {
  try { return JSON.parse(localStorage.getItem(APPEARANCE_KEY)) || {}; } catch { return {}; }
}

let lastZoom = null;
function applyTheme(settings) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const dark = s.theme === 'dark' || (s.theme === 'system' && darkQuery.matches);
  const root = document.documentElement;
  root.dataset.theme = dark ? 'dark' : 'light';
  root.dataset.aurora = s.aurora ? 'on' : 'off';
  root.dataset.darkStyle = s.darkStyle === 'trimble' ? 'trimble' : 'midnight';
  root.style.setProperty('--accent', s.accent);
  // Brand colors carry their exact gradient partner; otherwise CSS derives one.
  if (s.accent2) root.style.setProperty('--accent-2', s.accent2);
  else root.style.removeProperty('--accent-2');
  root.style.setProperty('--on-accent', relLuminance(s.accent) > 0.42 ? '#17130d' : '#ffffff');
  const darkBg = s.darkStyle === 'trimble' ? '#1c2024' : '#0b0d12';
  bridge.app.setTitleBar(dark ? { color: darkBg, symbolColor: '#c3c8d3' } : { color: '#f4f5f8', symbolColor: '#3b4250' });
  if (isElectron && s.zoom !== lastZoom) {
    lastZoom = s.zoom;
    bridge.app.setZoom(s.zoom || 1);
  }
  try {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ theme: s.theme, accent: s.accent, accent2: s.accent2, darkStyle: s.darkStyle, aurora: s.aurora }));
  } catch {}
}

function App() {
  const { profile, data } = useSession();
  const settings = data?.settings;

  useEffect(() => {
    applyTheme(settings || readAppearance());
    const onChange = () => applyTheme(settings || readAppearance());
    darkQuery.addEventListener('change', onChange);
    return () => darkQuery.removeEventListener('change', onChange);
  }, [settings]);

  if (!profile || !data) return html`<${ProfileGate} />`;
  return html`<${Shell} />`;
}

// ---------------------------------------------------------------- shortcuts

window.addEventListener('keydown', (e) => {
  if (!document.querySelector('.shell')) return;
  const modalOpen = Boolean(document.querySelector('.modal-layer'));
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'l') {
    e.preventDefault();
    if (!modalOpen) openLog();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && !modalOpen && ['1', '2', '3', '4'].includes(k)) {
    e.preventDefault();
    nav(['calendar', 'clients', 'notes', 'settings'][Number(k) - 1], k === '2' ? { clientId: null } : {});
  }
});

// ----------------------------------------------------------------- tooltips
// One floating tooltip for every [data-tip] element, so tips are never clipped
// by scroll containers.

const tip = document.createElement('div');
tip.className = 'tooltip';
document.body.appendChild(tip);
let tipTimer = null;
let tipTarget = null;

function hideTip() {
  clearTimeout(tipTimer);
  tipTarget = null;
  tip.classList.remove('is-visible');
}

document.addEventListener('mouseover', (e) => {
  const el = e.target.closest?.('[data-tip]');
  if (el === tipTarget) return;
  hideTip();
  if (!el || !el.dataset.tip) return;
  tipTarget = el;
  tipTimer = setTimeout(() => {
    if (!document.body.contains(el)) return;
    tip.textContent = el.dataset.tip;
    const r = el.getBoundingClientRect();
    tip.classList.add('is-visible');
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let top = r.top - th - 8;
    if (top < 6) top = r.bottom + 8;
    const left = Math.min(window.innerWidth - tw - 8, Math.max(8, r.left + r.width / 2 - tw / 2));
    tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }, 380);
});
// Files dropped outside an image drop zone shouldn't navigate the window.
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

document.addEventListener('mousedown', hideTip, true);
document.addEventListener('scroll', hideTip, true);
window.addEventListener('blur', hideTip);

// --------------------------------------------------------------------- boot

// Dev hook used by scripts/snap.js to drive the UI for screenshots.
if (new URLSearchParams(location.search).has('debug')) window.__fl = { ...store, bridge, image };

async function boot() {
  applyTheme(readAppearance());
  if (isElectron) document.documentElement.classList.add('is-electron');
  // Reopen straight into the last profile unless it asks for a PIN on launch.
  try {
    const { lastProfileId, profiles } = await bridge.profiles.list();
    const last = profiles.find((p) => p.id === lastProfileId);
    if (last && (!last.hasPin || last.pinOnLaunch === false)) await signIn(last);
  } catch (err) {
    console.error('Could not restore last profile', err);
  }
  const root = document.getElementById('app');
  root.textContent = '';
  render(html`<${App} />`, root);
}

boot();
