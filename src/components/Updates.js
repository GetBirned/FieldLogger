// New-version notices: the banner at the top of the app, the "what's new" dialog, and the
// update-folder section in Settings. Versions come from a shared folder (main.js, updates:*).
import { html, useEffect, useState } from '../lib/h.js';
import { bridge, isElectron } from '../lib/bridge.js';
import { useUi, setUi, checkForUpdates, installUpdate, toast } from '../lib/store.js';
import { fmtDateLong, parseKey, relativeTime } from '../lib/time.js';
import { Button, Icon, Modal, cx } from './ui.js';

const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;

const KIND = { new: { label: 'New', cls: 'badge-accent' }, improved: { label: 'Improved', cls: 'badge-muted' }, fixed: { label: 'Fixed', cls: 'badge-ok' } };

// Checks at startup and every few hours (desktop app only).
export function useUpdateChecks() {
  useEffect(() => {
    if (!isElectron) return undefined;
    checkForUpdates();
    const t = setInterval(checkForUpdates, CHECK_EVERY_MS);
    return () => clearInterval(t);
  }, []);
}

export function UpdateBanner() {
  const { update, updateDismissed } = useUi();
  if (update?.status !== 'available' || updateDismissed === update.version) return null;
  return html`<div class="update-banner" role="status">
    <span class="update-banner-icon"><${Icon} name="sparkles" size=${16} /></span>
    <span class="update-banner-text"><b>FieldLogger ${update.version} is available.</b> ${update.notes?.title || 'See what changed and update in one click.'}</span>
    <${Button} size="sm" variant="ghost" onClick=${() => setUi({ updateDismissed: update.version })}>Later<//>
    <${Button} size="sm" variant="primary" icon="download" onClick=${() => setUi({ updateOpen: true })}>See what's new<//>
  </div>`;
}

export function UpdateDialog() {
  const { update, updateOpen } = useUi();
  const [state, setState] = useState('idle'); // idle | installing
  if (!updateOpen || update?.status !== 'available') return null;
  const notes = update.notes;
  const close = () => { if (state !== 'installing') setUi({ updateOpen: false }); };

  const install = async () => {
    setState('installing');
    try {
      await installUpdate();
    } catch (err) {
      setState('idle');
      toast(String(err.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), { tone: 'error', duration: 9000 });
    }
  };

  return html`<${Modal} title=${`FieldLogger ${update.version}`} subtitle=${update.date ? fmtDateLong(parseKey(update.date)) : 'A new version is ready'} icon="sparkles" onClose=${close} width=${560}
    footer=${state === 'installing'
      ? html`<span class="update-installing"><${Icon} name="refresh-cw" size=${16} /> Installing… FieldLogger will close and reopen in a moment.</span>`
      : html`<${Button} variant="ghost" onClick=${close}>Not now<//><${Button} variant="primary" icon="download" onClick=${install}>Update now<//>`}>
    <div class="update-dialog">
      ${notes?.title && html`<h3 class="update-title">${notes.title}</h3>`}
      ${notes?.items?.length
        ? html`<ul class="release-items">
            ${notes.items.map((it) => html`<li><span class=${cx('badge', KIND[it.kind]?.cls)}>${KIND[it.kind]?.label || it.kind}</span><span>${it.text}</span></li>`)}
          </ul>`
        : html`<p class="muted">This version doesn't list its changes.</p>`}
      <p class="set-hint update-safety"><${Icon} name="shield-check" size=${14} /> Your data is saved first, and a full copy is kept before the new version opens it.</p>
    </div>
  <//>`;
}

// Settings → Update log: where updates come from, and a manual check.
export function UpdateSettings() {
  const { update } = useUi();
  const [config, setConfig] = useState(null);
  const load = () => bridge.updates.config().then(setConfig);
  useEffect(() => { load(); }, []);

  if (!isElectron) return html`<p class="set-hint">Updates are checked by the desktop app.</p>`;
  if (!config) return null;

  const choose = async (folder) => {
    try {
      const set = await bridge.updates.setFolder(folder);
      if (set === null) return;
      await load();
      checkForUpdates();
    } catch (err) {
      toast(String(err.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), { tone: 'error' });
    }
  };

  const status = (() => {
    if (update?.checking) return { icon: 'refresh-cw', text: 'Checking…' };
    switch (update?.status) {
      case 'available': return { icon: 'sparkles', text: `Version ${update.version} is available.`, tone: 'accent' };
      case 'current': return { icon: 'circle-check', text: `You're up to date (${config.version}).`, tone: 'ok' };
      case 'unreachable': return { icon: 'triangle-alert', text: `Couldn't reach the update folder: ${update.error}`, tone: 'warn' };
      case 'not-configured': return { icon: 'info', text: 'No update folder set yet.' };
      default: return { icon: 'info', text: 'Not checked yet.' };
    }
  })();

  return html`<div class="update-settings">
    <div class="data-path">
      <${Icon} name="folder-open" size=${18} />
      <code>${config.folder || 'No folder chosen'}</code>
      <${Button} size="sm" onClick=${() => choose(undefined)}>${config.folder ? 'Change' : 'Choose folder'}<//>
      ${config.custom && config.builtIn && html`<${Button} size="sm" variant="ghost" onClick=${() => choose('')}>Use default<//>`}
    </div>
    <div class=${cx('update-status', status.tone && `is-${status.tone}`)}>
      <${Icon} name=${status.icon} size=${15} />
      <span>${status.text}${update?.checkedAt && !update.checking ? html` <span class="muted">· checked ${relativeTime(update.checkedAt)}</span>` : ''}</span>
      <div class="toolbar-spacer"></div>
      ${update?.status === 'available' && html`<${Button} size="sm" variant="primary" icon="download" onClick=${() => setUi({ updateOpen: true })}>See what's new<//>`}
      <${Button} size="sm" icon="refresh-cw" disabled=${!config.folder || update?.checking} onClick=${checkForUpdates}>Check now<//>
    </div>
    <p class="set-hint">FieldLogger checks this folder when it starts and every few hours. Use a shared OneDrive, SharePoint or network folder that everyone on the team can open.</p>
  </div>`;
}
