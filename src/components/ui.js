// Shared UI building blocks.
import { html, useEffect, useRef, useState } from '../lib/h.js';
import { ICONS } from '../vendor/icons.js';
import { PALETTE } from '../lib/defaults.js';
import { chooseImage, imageFromTransfer } from '../lib/image.js';

export const cx = (...parts) => parts.filter(Boolean).join(' ');

export function Icon({ name, size = 18, stroke = 2, class: cls, style }) {
  const inner = ICONS[name] || ICONS.circle;
  return html`<svg class=${cx('icon', cls)} style=${style} width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width=${stroke} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: inner }}></svg>`;
}

export function Button({ variant = 'secondary', size, icon, iconRight, children, class: cls, ...rest }) {
  return html`<button type="button" class=${cx('btn', `btn-${variant}`, size && `btn-${size}`, !children && 'btn-icon-only', cls)} ...${rest}>
    ${icon && html`<${Icon} name=${icon} size=${size === 'sm' ? 15 : 17} />`}
    ${children && html`<span>${children}</span>`}
    ${iconRight && html`<${Icon} name=${iconRight} size=${size === 'sm' ? 15 : 17} />`}
  </button>`;
}

export function IconButton({ icon, label, size = 17, class: cls, ...rest }) {
  return html`<button type="button" class=${cx('icon-btn', cls)} aria-label=${label} data-tip=${label} ...${rest}>
    <${Icon} name=${icon} size=${size} />
  </button>`;
}

export function Kbd({ children }) {
  return html`<kbd class="kbd">${children}</kbd>`;
}

// Round (or squircle) avatar: a photo when there is one, else initials.
export function Avatar({ name = '?', color = '#64748b', size = 36, square, src, class: cls }) {
  const box = { '--av': color, width: `${size}px`, height: `${size}px` };
  if (src) {
    return html`<div class=${cx('avatar avatar-photo', square && 'avatar-square', cls)} style=${box}><img src=${src} alt="" draggable="false" /></div>`;
  }
  const initials = String(name).trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';
  return html`<div class=${cx('avatar', square && 'avatar-square', cls)} style=${{ ...box, fontSize: `${Math.round(size * 0.38)}px` }}>${initials}</div>`;
}

// A client's logo on a light (or dark) plate, falling back to initials.
export function ClientAvatar({ client, size = 36, class: cls }) {
  if (client?.logo) {
    return html`<div class=${cx('logo-plate', client.logoBg === 'dark' && 'is-dark', size <= 20 && 'is-tiny', cls)}
        style=${{ width: `${size}px`, height: `${size}px` }}>
      <img src=${client.logo} alt="" draggable="false" />
    </div>`;
  }
  return html`<${Avatar} name=${client?.name || '?'} color=${client?.color || '#64748b'} size=${size} square class=${cls} />`;
}

// A client's accounting / ERP system as a logo plate; systems without a logo get a calculator icon.
export function ErpLogo({ erp, logos, size = 20, class: cls }) {
  const src = logos[erp];
  if (!src) {
    return html`<span class=${cx('erp-fallback', cls)} style=${{ width: `${size}px`, height: `${size}px` }}><${Icon} name="calculator" size=${Math.round(size * 0.62)} /></span>`;
  }
  return html`<span class=${cx('logo-plate', 'erp-plate', size <= 20 && 'is-tiny', cls)} style=${{ width: `${size}px`, height: `${size}px` }}>
    <img src=${src} alt="" draggable="false" />
  </span>`;
}

// Ctrl+V with a copied picture calls onFile(File) while the caller is mounted.
export function usePasteImage(onFile) {
  const ref = useRef(onFile);
  ref.current = onFile;
  useEffect(() => {
    const onPaste = (e) => {
      const file = imageFromTransfer(e.clipboardData);
      if (!file) return;
      e.preventDefault();
      ref.current(file);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []);
}

// Click or drop an image onto its children. Calls onFile(File).
export function ImageDrop({ onFile, children, tip = 'Click or drop an image', round, busy, class: cls }) {
  const [over, setOver] = useState(false);
  const open = async () => {
    const file = await chooseImage();
    if (file) onFile(file);
  };
  const drop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOver(false);
    const file = imageFromTransfer(e.dataTransfer);
    if (file) onFile(file);
  };
  return html`<div role="button" tabindex="0" class=${cx('image-drop', over && 'is-over', round && 'is-round', busy && 'is-busy', cls)} data-tip=${tip}
      onClick=${open} onKeyDown=${(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open())}
      onDragOver=${(e) => { e.preventDefault(); setOver(true); }} onDragLeave=${() => setOver(false)} onDrop=${drop}>
    ${children}
    <span class="image-drop-badge"><${Icon} name="camera" size=${13} /></span>
  </div>`;
}

export function TypeBadge({ type, size = 30 }) {
  return html`<span class="type-badge" style=${{ '--tc': type?.color || '#64748b', width: `${size}px`, height: `${size}px` }}>
    <${Icon} name=${type?.icon || 'circle-dot'} size=${Math.round(size * 0.55)} />
  </span>`;
}

export function Segmented({ value, options, onChange, size, class: cls }) {
  return html`<div class=${cx('segmented', size && `segmented-${size}`, cls)} role="tablist">
    ${options.map((o) => html`<button type="button" role="tab" aria-selected=${o.value === value}
        class=${cx('seg', o.value === value && 'is-active')} onClick=${() => onChange(o.value)} data-tip=${o.tip}>
        ${o.icon && html`<${Icon} name=${o.icon} size=${15} />`}${o.label && html`<span>${o.label}</span>`}
      </button>`)}
  </div>`;
}

export function Switch({ checked, onChange, label, hint }) {
  return html`<label class="switch-row">
    <span class="switch-text">${label && html`<span class="switch-label">${label}</span>`}${hint && html`<span class="switch-hint">${hint}</span>`}</span>
    <button type="button" role="switch" aria-checked=${Boolean(checked)} class=${cx('switch', checked && 'is-on')} onClick=${() => onChange(!checked)}>
      <span class="switch-thumb"></span>
    </button>
  </label>`;
}

// Use group for fields that hold buttons/segmented controls (a <label> would
// forward clicks on its text to the first button inside it).
export function Field({ label, hint, error, children, group, class: cls }) {
  const tag = group ? 'div' : 'label';
  return html`<${tag} class=${cx('field', cls)}>
    ${label && html`<span class="field-label">${label}</span>`}
    ${children}
    ${error ? html`<span class="field-error">${error}</span>` : hint && html`<span class="field-hint">${hint}</span>`}
  <//>`;
}

export function ColorPicker({ value, onChange, colors = PALETTE, allowCustom = true }) {
  return html`<div class="swatches">
    ${colors.map((c) => html`<button type="button" class=${cx('swatch', value?.toLowerCase() === c.toLowerCase() && 'is-active')} style=${{ '--sw': c }}
      aria-label=${c} onClick=${() => onChange(c)}></button>`)}
    ${allowCustom && html`<label class="swatch swatch-custom" data-tip="Custom color" style=${{ '--sw': value }}>
      <${Icon} name="plus" size=${14} />
      <input type="color" value=${value} onInput=${(e) => onChange(e.currentTarget.value)} />
    </label>`}
  </div>`;
}

export function EmptyState({ icon = 'inbox', title, children, action }) {
  return html`<div class="empty">
    <div class="empty-icon"><${Icon} name=${icon} size=${26} /></div>
    <div class="empty-title">${title}</div>
    ${children && html`<div class="empty-text">${children}</div>`}
    ${action}
  </div>`;
}

// Only the top-most open modal reacts to Escape.
const modalStack = [];

// Modal with backdrop, Esc-to-close and a soft entrance animation. Inner
// widgets that use Escape themselves (pickers, menus) stop its propagation.
export function Modal({ title, subtitle, icon, onClose, children, footer, width = 560, initialFocus, class: cls }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const token = {};
    modalStack.push(token);
    const onKey = (e) => {
      if (e.key === 'Escape' && modalStack[modalStack.length - 1] === token) {
        e.preventDefault();
        closeRef.current?.();
      }
    };
    window.addEventListener('keydown', onKey);
    const first = (initialFocus && ref.current?.querySelector(initialFocus))
      || ref.current?.querySelector('[autofocus]')
      || ref.current?.querySelector('input:not([type=hidden]):not([type=color]), textarea');
    const t = setTimeout(() => first?.focus(), 30);
    return () => {
      clearTimeout(t);
      modalStack.splice(modalStack.indexOf(token), 1);
      window.removeEventListener('keydown', onKey);
    };
  }, []);
  return html`<div class="modal-layer" onMouseDown=${(e) => e.target === e.currentTarget && onClose?.()}>
    <div ref=${ref} class=${cx('modal', cls)} style=${{ width: `min(${width}px, calc(100vw - 32px))` }} role="dialog" aria-modal="true">
      ${title && html`<header class="modal-head">
        ${icon && html`<div class="modal-icon"><${Icon} name=${icon} size=${18} /></div>`}
        <div class="modal-titles"><h2>${title}</h2>${subtitle && html`<p>${subtitle}</p>`}</div>
        <${IconButton} icon="x" label="Close (Esc)" onClick=${onClose} />
      </header>`}
      <div class="modal-body">${children}</div>
      ${footer && html`<footer class="modal-foot">${footer}</footer>`}
    </div>
  </div>`;
}

// Small dropdown menu anchored to a trigger button.
export function Menu({ trigger, items, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return html`<div class="menu-wrap" ref=${ref}>
    ${trigger({ open, toggle: () => setOpen(!open) })}
    ${open && html`<div class=${cx('menu', `menu-${align}`)}>
      ${items.filter(Boolean).map((it) => (it === '-'
        ? html`<div class="menu-sep"></div>`
        : html`<button type="button" class=${cx('menu-item', it.danger && 'is-danger')} onClick=${() => { setOpen(false); it.run(); }}>
            ${it.icon && html`<${Icon} name=${it.icon} size=${16} />`}<span>${it.label}</span>
          </button>`))}
    </div>`}
  </div>`;
}

// Copy button that flips to a check for a moment.
export function CopyButton({ text, onCopy, label = 'Copy', compact, class: cls }) {
  const [done, setDone] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const click = async (e) => {
    e.stopPropagation();
    await onCopy(typeof text === 'function' ? text() : text);
    setDone(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDone(false), 1400);
  };
  return compact
    ? html`<button type="button" class=${cx('icon-btn copy-btn', done && 'is-done', cls)} aria-label=${label} data-tip=${done ? 'Copied!' : label} onClick=${click}>
        <${Icon} name=${done ? 'check' : 'copy'} size=${16} />
      </button>`
    : html`<button type="button" class=${cx('btn btn-secondary btn-sm copy-btn', done && 'is-done', cls)} onClick=${click}>
        <${Icon} name=${done ? 'check' : 'copy'} size=${15} /><span>${done ? 'Copied' : label}</span>
      </button>`;
}

export function Progress({ value, max = 1, tone }) {
  const pct = max ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return html`<div class=${cx('progress', tone && `progress-${tone}`)}><span style=${{ width: `${pct}%` }}></span></div>`;
}

export function Ring({ value, max = 1, size = 44, stroke = 5, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max ? Math.min(1, Math.max(0, value / max)) : 0;
  return html`<div class="ring" style=${{ width: `${size}px`, height: `${size}px` }}>
    <svg width=${size} height=${size} viewBox=${`0 0 ${size} ${size}`}>
      <circle cx=${size / 2} cy=${size / 2} r=${r} fill="none" stroke-width=${stroke} class="ring-track" />
      <circle cx=${size / 2} cy=${size / 2} r=${r} fill="none" stroke-width=${stroke} class="ring-value"
        stroke-dasharray=${c} stroke-dashoffset=${c * (1 - pct)} stroke-linecap="round" transform=${`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
    <div class="ring-label">${children}</div>
  </div>`;
}
