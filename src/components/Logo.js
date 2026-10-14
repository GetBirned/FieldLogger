// FieldLogger mark: an "F" whose top bar runs into a backwards "L" (right post
// and bottom bar), so both initials share one square outline. In the app the
// letters follow the accent color; assets/logo.svg is the fixed-color version
// used for the app icon.
import { html, useId } from '../lib/h.js';
import { APP_NAME } from '../lib/defaults.js';

// Drawn on a 287x358 grid, then scaled into the 512x512 box. Both letters go in
// one path so they meet without an anti-aliasing seam.
const MARK_PATH = 'M0 26Q0 0 26 0L240 0L240 41L55 41Q47 41 47 49L47 145Q47 153 55 153L181 153Q193 153 193 165L193 182Q193 194 181 194L55 194Q47 194 47 202L47 346Q47 358 35 358L26 358Q0 358 0 332Z'
  + 'M240 0L261 0Q287 0 287 26L287 332Q287 358 261 358L107 358Q95 358 95 346L95 329Q95 317 107 317L232 317Q240 317 240 309Z';

export function LogoMark({ size = 36, fixed = false }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const a = fixed ? '#ffb347' : 'var(--logo-a)';
  const b = fixed ? '#ff7a1a' : 'var(--logo-b)';
  const c = fixed ? '#ef4423' : 'var(--logo-c)';
  return html`<svg class="logo-mark" width=${size} height=${size} viewBox="0 0 512 512" aria-hidden="true">
    <defs>
      <linearGradient id=${`mk${id}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="287" y2="358">
        <stop offset="0" style=${{ stopColor: a }} />
        <stop offset="0.55" style=${{ stopColor: b }} />
        <stop offset="1" style=${{ stopColor: c }} />
      </linearGradient>
    </defs>
    <path transform="translate(77 22) scale(1.25)" d=${MARK_PATH} fill=${`url(#mk${id})`} />
  </svg>`;
}

export function Wordmark({ size = 20 }) {
  return html`<span class="wordmark" style=${{ fontSize: `${size}px` }}>
    <span>${APP_NAME.replace(/Logger$/, '')}</span><span class="wordmark-accent">${APP_NAME.endsWith('Logger') ? 'Logger' : ''}</span>
  </span>`;
}
