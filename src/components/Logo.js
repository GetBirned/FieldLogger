// FieldLogger mark: a field pin whose head is a clock, with hands set at 10:08
// so they double as a check mark ("logged"). In the app the pin follows the
// accent color; assets/logo.svg is the fixed-color version used for the icon.
import { html, useId } from '../lib/h.js';
import { APP_NAME } from '../lib/defaults.js';

export function LogoMark({ size = 36, fixed = false }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const a = fixed ? '#ffb347' : 'var(--logo-a)';
  const b = fixed ? '#ff7a1a' : 'var(--logo-b)';
  const c = fixed ? '#ef4423' : 'var(--logo-c)';
  return html`<svg class="logo-mark" width=${size} height=${size} viewBox="0 0 512 512" aria-hidden="true">
    <defs>
      <linearGradient id=${`bg${id}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style=${{ stopColor: '#1f2d5c' }} />
        <stop offset="1" style=${{ stopColor: '#0a1029' }} />
      </linearGradient>
      <linearGradient id=${`pin${id}`} x1="0.15" y1="0" x2="0.85" y2="1">
        <stop offset="0" style=${{ stopColor: a }} />
        <stop offset="0.5" style=${{ stopColor: b }} />
        <stop offset="1" style=${{ stopColor: c }} />
      </linearGradient>
      <radialGradient id=${`glow${id}`} cx="0.5" cy="0.38" r="0.6">
        <stop offset="0" style=${{ stopColor: b, stopOpacity: 0.45 }} />
        <stop offset="1" style=${{ stopColor: b, stopOpacity: 0 }} />
      </radialGradient>
      <clipPath id=${`clip${id}`}><rect width="512" height="512" rx="118" /></clipPath>
    </defs>
    <g clip-path=${`url(#clip${id})`}>
      <rect width="512" height="512" fill=${`url(#bg${id})`} />
      <rect width="512" height="512" fill=${`url(#glow${id})`} />
      <g stroke="#ffffff" stroke-opacity="0.07" stroke-width="3">
        <path d="M64 0V512M128 0V512M192 0V512M256 0V512M320 0V512M384 0V512M448 0V512" />
        <path d="M0 64H512M0 128H512M0 192H512M0 256H512M0 320H512M0 384H512M0 448H512" />
      </g>
      <ellipse cx="256" cy="430" rx="92" ry="17" fill="#000" opacity="0.38" />
      <path d="M256 432C226 390 136 314 136 222a120 120 0 0 1 240 0c0 92-90 168-120 210Z" fill=${`url(#pin${id})`} />
      <path d="M256 432C226 390 136 314 136 222a120 120 0 0 1 240 0" fill="none" stroke="#fff" stroke-opacity="0.28" stroke-width="5" />
      <circle cx="256" cy="222" r="74" fill="#0c1433" />
      <g fill="#ffffff" opacity="0.55">
        <circle cx="256" cy="166" r="6.5" /><circle cx="312" cy="222" r="6.5" /><circle cx="256" cy="278" r="6.5" /><circle cx="200" cy="222" r="6.5" />
      </g>
      <path d="M222 196L256 230L304 176" fill="none" stroke="#ffffff" stroke-width="21" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="256" cy="230" r="11" fill=${b} stroke="#ffffff" stroke-width="6" />
    </g>
  </svg>`;
}

export function Wordmark({ size = 20 }) {
  return html`<span class="wordmark" style=${{ fontSize: `${size}px` }}>
    <span>${APP_NAME.replace(/Logger$/, '')}</span><span class="wordmark-accent">${APP_NAME.endsWith('Logger') ? 'Logger' : ''}</span>
  </span>`;
}
