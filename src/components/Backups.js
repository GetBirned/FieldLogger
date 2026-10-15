// The restorable copies of one profile's data (daily copies, the copy kept before the last
// save, snapshots taken before each update, and copies kept before a restore).
import { html, useEffect, useState } from '../lib/h.js';
import { bridge } from '../lib/bridge.js';
import { fmtDateShort, fmtTime, relativeTime } from '../lib/time.js';
import { Button, Icon, cx } from './ui.js';

const KIND_ICON = { daily: 'calendar-check', previous: 'history', update: 'refresh-cw', restore: 'rotate-ccw' };

// onRestore(backup) does the restore; the list reloads afterwards. `limit` hides older copies behind "Show all".
export function BackupList({ profileId, onRestore, limit = 6, highlightFirst = false }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [all, setAll] = useState(false);

  const load = () => bridge.backups.list(profileId).then(setList).catch((err) => setError(err.message || String(err)));
  useEffect(() => { load(); }, [profileId]);

  const restore = async (b) => {
    setBusy(b.key);
    try {
      await onRestore(b);
    } finally {
      setBusy(null);
      load();
    }
  };

  if (error) return html`<div class="form-error">${error}</div>`;
  if (!list) return html`<p class="set-hint">Looking for backups…</p>`;
  if (!list.length) {
    return html`<p class="set-hint">No backups yet. FieldLogger keeps its first copy the next time it saves your data.</p>`;
  }
  const shown = all ? list : list.slice(0, limit);
  return html`<div class="backup-list">
    ${shown.map((b, i) => html`<div key=${b.key} class=${cx('backup-row', highlightFirst && i === 0 && 'is-first')}>
      <span class="backup-icon"><${Icon} name=${KIND_ICON[b.kind] || 'archive'} size=${16} /></span>
      <div class="backup-text">
        <span class="backup-label">${b.label}</span>
        <span class="backup-meta">${fmtDateShort(b.at)}, ${fmtTime(b.at)} · ${relativeTime(b.at)} · ${b.clients} ${b.clients === 1 ? 'client' : 'clients'}, ${b.entries} ${b.entries === 1 ? 'entry' : 'entries'}</span>
      </div>
      <${Button} size="sm" variant=${highlightFirst && i === 0 ? 'primary' : 'secondary'} icon="rotate-ccw" disabled=${Boolean(busy)} onClick=${() => restore(b)}>
        ${busy === b.key ? 'Restoring…' : 'Restore'}
      <//>
    </div>`)}
    ${list.length > limit && html`<button type="button" class="link-btn" onClick=${() => setAll(!all)}>${all ? 'Show fewer' : `Show all ${list.length} copies`}</button>`}
  </div>`;
}
