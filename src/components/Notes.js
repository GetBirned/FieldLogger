// Kantata Notes: every entry for a day rendered as a copy-ready line,
// grouped by client/project with rounded hours.
import { html, useMemo, useRef } from '../lib/h.js';
import { useSession, useUi, setUi, setSettings, setEntered, openLog, openEdit, copyText, toast, nav } from '../lib/store.js';
import { bridge } from '../lib/bridge.js';
import { dateKey, todayKey, parseKey, addDaysKey, weekDays, fmtDateFull, fmtHours, roundHours, fmtDuration } from '../lib/time.js';
import { entriesOnDay, entryMinutes, renderLine, entriesToCsv } from '../lib/notes.js';
import { Button, ClientAvatar, CopyButton, EmptyState, Icon, IconButton, Menu, Progress, Segmented, Switch, TypeBadge, cx } from './ui.js';

export function NotesView() {
  const { data } = useSession();
  const u = useUi();
  const s = data.settings;
  const key = u.date;
  const dateInput = useRef(null);

  const typeById = useMemo(() => Object.fromEntries(data.actionTypes.map((t) => [t.id, t])), [data.actionTypes]);
  const clientById = useMemo(() => Object.fromEntries(data.clients.map((c) => [c.id, c])), [data.clients]);
  const rows = useMemo(() => entriesOnDay(data.entries, key).map((e) => {
    const type = typeById[e.typeId];
    const client = clientById[e.clientId];
    return { e, type, client, minutes: entryMinutes(e), line: renderLine(e, { type, client, settings: s }) };
  }), [data.entries, key, typeById, clientById, s.template, s.hour12, s.roundTo, s.roundMode]);

  const groups = useMemo(() => {
    if (s.notesGroup === 'time') return [{ id: 'all', client: null, title: 'Chronological', rows }];
    const map = new Map();
    for (const r of rows) {
      const id = r.e.clientId && r.client ? r.e.clientId : '_internal';
      if (!map.has(id)) map.set(id, { id, client: r.client || null, rows: [] });
      map.get(id).rows.push(r);
    }
    return [...map.values()];
  }, [rows, s.notesGroup]);

  const groupHours = (g) => roundHours(g.rows.reduce((m, r) => m + r.minutes, 0), s.roundTo, s.roundMode);
  const totalHours = s.notesGroup === 'time'
    ? roundHours(rows.reduce((m, r) => m + r.minutes, 0), s.roundTo, s.roundMode)
    : groups.reduce((h, g) => h + groupHours(g), 0);
  const enteredCount = rows.filter((r) => r.e.entered).length;

  const onCopyLine = async (r, text) => {
    await copyText(text, 'Line copied. Paste it into Kantata');
    if (s.autoMarkOnCopy && !r.e.entered) setEntered([r.e.id], true);
  };
  const onCopyGroup = async (g, text) => {
    await copyText(text, `${g.rows.length} ${g.rows.length === 1 ? 'line' : 'lines'} copied`);
    if (s.autoMarkOnCopy) setEntered(g.rows.map((r) => r.e.id), true);
  };

  const exportCsv = async (range) => {
    let keys;
    if (range === 'day') keys = [key];
    else if (range === 'week') keys = weekDays(parseKey(key), s.weekStart, true).map(dateKey);
    else {
      const d = parseKey(key);
      keys = Array.from({ length: 31 }, (_, i) => new Date(d.getFullYear(), d.getMonth(), i + 1)).filter((x) => x.getMonth() === d.getMonth()).map(dateKey);
    }
    const set = new Set(keys);
    const list = data.entries.filter((e) => set.has(dateKey(new Date(e.start))));
    if (!list.length) return toast(`Nothing logged that ${range}`, { tone: 'info' });
    const csv = entriesToCsv(list, { typeById, clientById, settings: s });
    const name = `FieldLogger-${range === 'day' ? key : range === 'week' ? `week-of-${keys[0]}` : key.slice(0, 7)}.csv`;
    const saved = await bridge.data.exportText(csv, name);
    if (saved) toast(`Exported ${list.length} entries`, { icon: 'download' });
  };

  const openPicker = () => {
    try { dateInput.current?.showPicker(); } catch { dateInput.current?.focus(); }
  };

  return html`<div class="notes">
    <div class="toolbar">
      <${Button} size="sm" variant=${key === todayKey() ? 'secondary' : 'accent-soft'} onClick=${() => setUi({ date: todayKey() })}>Today<//>
      <div class="cal-arrows">
        <${IconButton} icon="chevron-left" label="Previous day" onClick=${() => setUi({ date: addDaysKey(key, -1) })} />
        <${IconButton} icon="chevron-right" label="Next day" onClick=${() => setUi({ date: addDaysKey(key, 1) })} />
      </div>
      <button type="button" class="date-title" onClick=${openPicker}>
        <span>${fmtDateFull(parseKey(key))}</span><${Icon} name="chevron-down" size=${16} />
        <input ref=${dateInput} type="date" value=${key} tabindex="-1" onInput=${(e) => e.currentTarget.value && setUi({ date: e.currentTarget.value })} />
      </button>
      <div class="toolbar-spacer"></div>
      <${Segmented} value=${s.notesGroup} onChange=${(v) => setSettings({ notesGroup: v })} options=${[
        { value: 'client', label: 'By client', icon: 'building-2' },
        { value: 'time', label: 'Chronological', icon: 'list' },
      ]} />
      <${Menu} trigger=${({ toggle }) => html`<${Button} icon="download" iconRight="chevron-down" onClick=${toggle}>Export<//>`} items=${[
        { label: 'This day as CSV', icon: 'file-spreadsheet', run: () => exportCsv('day') },
        { label: 'This week as CSV', icon: 'file-spreadsheet', run: () => exportCsv('week') },
        { label: 'This month as CSV', icon: 'file-spreadsheet', run: () => exportCsv('month') },
      ]} />
      ${rows.length > 0 && html`<${CopyButton} text=${() => rows.map((r) => r.line).join('\n')} label="Copy all" onCopy=${(t) => onCopyGroup({ rows }, t)} class="btn-primary-soft" />`}
    </div>

    ${rows.length === 0
      ? html`<div class="card notes-empty"><${EmptyState} icon="clipboard-list" title="Nothing logged on this day"
          action=${html`<div class="row-gap"><${Button} variant="primary" icon="plus" onClick=${() => openLog(key === todayKey() ? {} : { dateKey: key })}>Log Action<//>
            <${Button} icon="calendar-days" onClick=${() => nav('calendar', { calView: 'day' })}>Open calendar<//></div>`}>
          Logged actions appear here as ready-to-paste lines, like <code>2:15 PM: Phone Call - Reviewed import errors</code>.
        <//></div>`
      : html`
        <div class="notes-summary card">
          <div class="ns-item"><span class="eyebrow">Hours to enter</span><b>${fmtHours(totalHours)}<small>h</small></b>
            <span class="muted">${s.roundTo ? `Rounded ${s.roundMode === 'up' ? 'up ' : ''}to ${s.roundTo}h per project` : 'Exact'}</span></div>
          <div class="ns-item"><span class="eyebrow">Entries</span><b>${rows.length}</b><span class="muted">${groups.length} ${s.notesGroup === 'time' ? 'list' : groups.length === 1 ? 'project' : 'projects'}</span></div>
          <div class="ns-item ns-progress">
            <span class="eyebrow">Entered in Kantata</span>
            <b>${enteredCount}<small>/${rows.length}</small></b>
            <${Progress} value=${enteredCount} max=${rows.length} tone=${enteredCount === rows.length ? 'ok' : null} />
          </div>
          <div class="ns-item ns-toggle">
            <${Switch} checked=${s.autoMarkOnCopy} onChange=${(v) => setSettings({ autoMarkOnCopy: v })} label="Check off on copy" hint="Copying a line marks it entered." />
          </div>
        </div>

        ${enteredCount === rows.length && html`<div class="all-done"><${Icon} name="party-popper" size=${18} /> All caught up. Every entry for this day is in Kantata.</div>`}

        <div class="note-groups">
          ${groups.map((g, gi) => {
            const hours = groupHours(g);
            const done = g.rows.every((r) => r.e.entered);
            const color = g.client?.color || 'var(--faint)';
            return html`<section class=${cx('card note-group', done && 'is-done')} style=${{ '--cc': color, animationDelay: `${gi * 40}ms` }}>
              <header class="ng-head">
                ${s.notesGroup === 'time'
                  ? html`<div class="ng-icon"><${Icon} name="list" size=${18} /></div>`
                  : g.client ? html`<${ClientAvatar} client=${g.client} size=${40} />` : html`<div class="ng-icon"><${Icon} name="briefcase" size=${18} /></div>`}
                <div class="ng-titles">
                  <span class="ng-name">${s.notesGroup === 'time' ? 'All entries' : g.client?.name || 'Internal / no client'}</span>
                  ${s.notesGroup !== 'time' && html`<button type="button" class="ng-project" onClick=${() => copyText(g.client?.kantataProject || g.client?.name || 'Internal', 'Project name copied')} data-tip="Copy project name">
                    <${Icon} name="clipboard-list" size=${13} /> ${g.client?.kantataProject || 'No Kantata project set'}
                  </button>`}
                </div>
                <button type="button" class="hours-pill" onClick=${() => copyText(fmtHours(hours), `${fmtHours(hours)} hours copied`)} data-tip="Copy hours">
                  <span><b>${fmtHours(hours)}</b>h</span><${Icon} name="copy" size=${12} />
                </button>
                ${g.client?.engagementUrl && html`<a class="btn btn-secondary btn-sm" href=${g.client.engagementUrl} target="_blank" rel="noreferrer" data-tip="Open this client's engagement page">
                  <${Icon} name="external-link" size=${15} /><span>Open engagement</span></a>`}
                <${CopyButton} text=${() => g.rows.map((r) => r.line).join('\n')} label="Copy all" onCopy=${(t) => onCopyGroup(g, t)} />
                <${IconButton} icon=${done ? 'rotate-ccw' : 'list-checks'} label=${done ? 'Mark all not entered' : 'Mark all entered'} onClick=${() => setEntered(g.rows.map((r) => r.e.id), !done)} />
              </header>
              <div class="ng-lines">
                ${g.rows.map((r) => html`<div key=${r.e.id} class=${cx('nline', r.e.entered && 'is-entered')}>
                  <button type="button" class=${cx('check', r.e.entered && 'is-on')} onClick=${() => setEntered([r.e.id], !r.e.entered)} aria-label="Entered in Kantata" data-tip=${r.e.entered ? 'Entered in Kantata' : 'Mark as entered'}>
                    <${Icon} name="check" size=${13} stroke=${3} />
                  </button>
                  <${TypeBadge} type=${r.type} size=${26} />
                  <div class="nline-text" onClick=${() => openEdit(r.e.id)} title="Click to edit">
                    <span class="nline-line">${r.line}</span>
                    ${s.notesGroup === 'time' && html`<span class="nline-client">${r.client?.name || 'Internal'}</span>`}
                  </div>
                  <span class="nline-hours">${r.minutes ? fmtDuration(r.minutes) : html`<span class="faint">no time</span>`}</span>
                  <${CopyButton} compact text=${r.line} onCopy=${(t) => onCopyLine(r, t)} label="Copy line" />
                </div>`)}
              </div>
            </section>`;
          })}
        </div>

        <p class="notes-foot"><${Icon} name="info" size=${14} /> Line format <code>${s.template}</code>
          <button type="button" class="link" onClick=${() => nav('settings', { settingsTab: 'notes' })}>Change format</button></p>
      `}
  </div>`;
}
