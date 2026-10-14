// "Log Action" dialog: create or edit an entry, or start a live timer.
import { html, useEffect, useMemo, useRef, useState } from '../lib/h.js';
import {
  useSession, useUi, closeLog, addEntry, updateEntry, deleteEntry, startTimer, stopTimer, addClient, updateData, toast, setUi, copyText,
} from '../lib/store.js';
import { PALETTE } from '../lib/defaults.js';
import { dateKey, todayKey, toTimeInput, combine, minutesToInput, fmtDuration, fmtDateLong } from '../lib/time.js';
import { renderLine } from '../lib/notes.js';
import { Button, ClientAvatar, CopyButton, Field, Icon, Kbd, Modal, Segmented, Switch, TypeBadge, cx } from './ui.js';

const DURATIONS = [
  { value: 0, label: 'None' },
  { value: 15, label: '15m' },
  { value: 30, label: '30m' },
  { value: 45, label: '45m' },
  { value: 60, label: '1h' },
  { value: 90, label: '1.5h' },
  { value: 120, label: '2h' },
];

const roundTo15 = (min) => Math.round(min / 15) * 15;

export function LogModal({ state }) {
  const { data } = useSession();
  const u = useUi();
  const s = data.settings;
  const editing = state.mode === 'edit';
  const existing = editing ? data.entries.find((e) => e.id === state.entryId) : null;
  const pre = state.prefill || {};

  const init = useMemo(() => {
    const now = new Date();
    if (existing) {
      const st = new Date(existing.start);
      return {
        typeId: existing.typeId,
        clientId: existing.clientId,
        mode: existing.end ? 'range' : 'now',
        day: dateKey(st),
        time: toTimeInput(st),
        startT: toTimeInput(st),
        endT: existing.end ? toTimeInput(existing.end) : toTimeInput(new Date(st.getTime() + 30 * 60000)),
        minutes: existing.minutes || 0,
        notes: existing.notes || '',
        entered: Boolean(existing.entered),
      };
    }
    const type = data.actionTypes.find((t) => t.id === pre.typeId);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const endMin = pre.endMin ?? Math.min(24 * 60 - 1, roundTo15(nowMin));
    const startMin = pre.startMin ?? Math.max(0, endMin - (type?.minutes || 60));
    return {
      typeId: pre.typeId || null,
      // undefined = not chosen yet, null = explicitly internal
      clientId: pre.clientId,
      mode: pre.mode || 'now',
      day: pre.dateKey || todayKey(),
      time: toTimeInput(now),
      startT: minutesToInput(startMin),
      endT: minutesToInput(endMin),
      minutes: type?.minutes ?? 0,
      notes: '',
      entered: false,
    };
  }, []);

  const [typeId, setTypeId] = useState(init.typeId);
  const [clientId, setClientId] = useState(init.clientId);
  const [mode, setMode] = useState(init.mode);
  const [day, setDay] = useState(init.day);
  const [time, setTime] = useState(init.time);
  const [startT, setStartT] = useState(init.startT);
  const [endT, setEndT] = useState(init.endT);
  const [minutes, setMinutes] = useState(init.minutes);
  const [notes, setNotes] = useState(init.notes);
  const [entered, setEntered] = useState(init.entered);
  const [touched, setTouched] = useState({ when: editing || Boolean(pre.dateKey && pre.dateKey !== todayKey()), minutes: editing, range: editing || pre.startMin != null });
  const [errors, setErrors] = useState({});
  const [, tick] = useState(0);
  const notesRef = useRef(null);

  // Keep the "now" stamp live until the user edits the time.
  useEffect(() => {
    if (touched.when || mode !== 'now') return undefined;
    const t = setInterval(() => { setTime(toTimeInput(new Date())); setDay(todayKey()); tick((x) => x + 1); }, 15000);
    return () => clearInterval(t);
  }, [touched.when, mode]);

  const recentClients = useMemo(() => {
    const seen = new Set();
    const out = [];
    const sorted = data.entries.slice().sort((a, b) => new Date(b.start) - new Date(a.start));
    for (const e of sorted) {
      if (!e.clientId || seen.has(e.clientId)) continue;
      seen.add(e.clientId);
      const c = data.clients.find((x) => x.id === e.clientId && x.active);
      if (c) out.push(c);
      if (out.length === 3) break;
    }
    return out;
  }, [data.entries, data.clients]);

  const types = data.actionTypes.filter((t) => !t.archived || t.id === typeId);
  const type = data.actionTypes.find((t) => t.id === typeId);
  const client = data.clients.find((c) => c.id === clientId);

  const pickType = (t) => {
    setTypeId(t.id);
    setErrors((e) => ({ ...e, type: null }));
    if (!touched.minutes) setMinutes(t.minutes || 0);
    if (mode === 'range' && !touched.range) {
      const [eh, em] = endT.split(':').map(Number);
      setStartT(minutesToInput(Math.max(0, eh * 60 + em - (t.minutes || 60))));
    }
    setTimeout(() => notesRef.current?.focus(), 0);
  };

  const draft = () => {
    if (mode === 'range') {
      return { start: combine(day, startT).toISOString(), end: combine(day, endT).toISOString(), minutes: null };
    }
    const start = !touched.when && !editing ? new Date() : combine(day, time);
    return { start: start.toISOString(), end: null, minutes: minutes || null };
  };

  const preview = useMemo(() => {
    if (mode === 'timer') return null;
    const d = draft();
    return renderLine({ ...d, typeId, clientId, notes }, { type, client, settings: s });
  });

  const rangeMinutes = (() => {
    const a = combine(day, startT);
    const b = combine(day, endT);
    return (b - a) / 60000;
  })();

  const submit = () => {
    const errs = {};
    if (!typeId) errs.type = 'Pick what you did.';
    if (mode === 'range' && !(rangeMinutes > 0)) errs.range = 'End time needs to be after the start time.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    if (mode === 'timer') {
      if (data.timer) {
        const prev = stopTimer();
        if (prev) toast('Previous timer stopped and logged', { tone: 'info', icon: 'timer' });
      }
      startTimer({ typeId, clientId, notes: notes.trim() });
      toast(`Timer running · ${type.name}`, { icon: 'timer' });
      closeLog();
      return;
    }

    const d = draft();
    const fields = { typeId, clientId: clientId || null, notes: notes.trim(), ...d };
    if (editing) {
      updateEntry(existing.id, { ...fields, entered, enteredAt: entered ? existing.enteredAt || new Date().toISOString() : null });
      toast('Entry updated', { icon: 'circle-check' });
    } else {
      const entry = addEntry(fields);
      toast(`Logged ${type.name}${client ? ` · ${client.name}` : ''}`, {
        icon: 'circle-check',
        action: { label: 'Undo', run: () => updateData((dd) => ({ ...dd, entries: dd.entries.filter((x) => x.id !== entry.id) })) },
      });
    }
    if (u.page === 'calendar') setUi({ date: dateKey(new Date(d.start)) });
    closeLog();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submit();
    }
  };

  const duplicate = () => {
    const d = draft();
    addEntry({ typeId, clientId, notes: notes.trim(), ...d, entered: false });
    toast('Entry duplicated', { icon: 'copy' });
    closeLog();
  };

  if (editing && !existing) {
    closeLog();
    return null;
  }

  const modeOptions = editing
    ? [{ value: 'now', label: 'Timestamp', icon: 'clock' }, { value: 'range', label: 'Time range', icon: 'calendar-range' }]
    : [{ value: 'now', label: 'Timestamp', icon: 'clock' }, { value: 'range', label: 'Time range', icon: 'calendar-range' }, { value: 'timer', label: 'Start timer', icon: 'timer' }];

  const footer = html`
    ${editing && html`<div class="foot-left">
      <${Button} variant="ghost-danger" icon="trash-2" onClick=${() => { deleteEntry(existing.id); closeLog(); }}>Delete<//>
      <${Button} variant="ghost" icon="copy" onClick=${duplicate}>Duplicate<//>
    </div>`}
    <span class="foot-hint"><${Kbd}>Ctrl<//><${Kbd}>Enter<//></span>
    <${Button} variant="ghost" onClick=${closeLog}>Cancel<//>
    <button type="button" class="btn btn-primary" onClick=${submit}>
      <${Icon} name=${mode === 'timer' ? 'play' : 'check'} size=${17} stroke=${2.4} />
      <span>${editing ? 'Save changes' : mode === 'timer' ? 'Start timer' : 'Log it'}</span>
    </button>`;

  return html`<${Modal} title=${editing ? 'Edit entry' : 'Log Action'} subtitle=${editing ? fmtDateLong(existing.start) : 'What did you just do?'}
      icon=${editing ? 'square-pen' : 'plus'} onClose=${closeLog} width=${960} class="log-modal" footer=${footer}
      initialFocus=${init.typeId ? 'textarea' : '.type-tile'}>
    <div class="log-form" onKeyDown=${onKeyDown}>
      <div class="field log-left">
        <span class="field-label">Action ${errors.type && html`<span class="field-error inline">${errors.type}</span>`}</span>
        <div class=${cx('type-grid', errors.type && 'has-error')}>
          ${types.map((t) => html`<button type="button" class=${cx('type-tile', typeId === t.id && 'is-active')} style=${{ '--tc': t.color }} onClick=${() => pickType(t)}>
            <${TypeBadge} type=${t} size=${28} />
            <span>${t.name}</span>
          </button>`)}
        </div>
      </div>

      <div class="log-right">
      <div class="field">
        <div class="field-label label-row">
          <span>Client</span>
          ${recentClients.length > 0 && html`<div class="recent-chips">
            <span class="faint">Recent</span>
            ${recentClients.map((c) => html`<button type="button" class=${cx('chip chip-client', c.id === clientId && 'is-active', c.logo && 'has-logo')} style=${{ '--cc': c.color }} onClick=${() => setClientId(c.id)} data-tip=${c.name}>
              ${c.logo ? html`<${ClientAvatar} client=${c} size=${18} />` : html`<span class="chip-dot"></span>`}<span class="chip-text">${c.name}</span>
            </button>`)}
          </div>`}
        </div>
        <${ClientPicker} value=${clientId} onChange=${setClientId} clients=${data.clients} entries=${data.entries} />
      </div>

      <div class="field">
        <span class="field-label">When</span>
        <${Segmented} value=${mode} options=${modeOptions} onChange=${setMode} class="seg-wide" />
        <div class="when-panel">
          ${mode === 'now' && html`<div class="when-row">
            <label class="mini-field"><span>Date</span>
              <input class="input" type="date" value=${day} onInput=${(e) => { setDay(e.currentTarget.value || todayKey()); setTouched((t) => ({ ...t, when: true })); }} />
            </label>
            <label class="mini-field"><span>Time ${!touched.when && !editing && html`<span class="live-badge"><span></span>Now</span>`}</span>
              <input class="input" type="time" value=${time} onInput=${(e) => { setTime(e.currentTarget.value); setTouched((t) => ({ ...t, when: true })); }} />
            </label>
            <div class="mini-field grow"><span>Time spent<span class="faint">for hours</span></span>
              <div class="chips">
                ${DURATIONS.map((d) => html`<button type="button" class=${cx('chip', minutes === d.value && 'is-active')}
                  onClick=${() => { setMinutes(d.value); setTouched((t) => ({ ...t, minutes: true })); }}>${d.label}</button>`)}
                <input class="input chip-input" type="number" min="0" max="720" step="5" placeholder="min"
                  value=${DURATIONS.some((d) => d.value === minutes) ? '' : minutes}
                  onInput=${(e) => { setMinutes(Math.max(0, Number(e.currentTarget.value) || 0)); setTouched((t) => ({ ...t, minutes: true })); }} />
              </div>
            </div>
          </div>`}
          ${mode === 'range' && html`<div class="when-row">
            <label class="mini-field"><span>Date</span>
              <input class="input" type="date" value=${day} onInput=${(e) => setDay(e.currentTarget.value || todayKey())} />
            </label>
            <label class="mini-field"><span>From</span>
              <input class="input" type="time" value=${startT} step="300" onInput=${(e) => { setStartT(e.currentTarget.value); setTouched((t) => ({ ...t, range: true })); }} />
            </label>
            <span class="range-arrow"><${Icon} name="arrow-right" size=${16} /></span>
            <label class="mini-field"><span>To</span>
              <input class="input" type="time" value=${endT} step="300" onInput=${(e) => { setEndT(e.currentTarget.value); setTouched((t) => ({ ...t, range: true })); }} />
            </label>
            <div class=${cx('range-total', !(rangeMinutes > 0) && 'is-bad')}>
              <span class="muted">Total</span>
              <b>${rangeMinutes > 0 ? fmtDuration(rangeMinutes) : '—'}</b>
            </div>
          </div>`}
          ${mode === 'timer' && html`<div class="timer-explain">
            <div class="timer-explain-icon"><${Icon} name="timer" size=${20} /></div>
            <div>
              <b>Start a live timer.</b> It runs in the top bar while you work. Hit stop and it lands on your calendar as a time range.
              ${data.timer && html`<div class="warn-line"><${Icon} name="info" size=${14} /> Your current timer will be stopped and logged first.</div>`}
            </div>
          </div>`}
          ${errors.range && html`<div class="field-error">${errors.range}</div>`}
        </div>
      </div>

      <${Field} label="Notes">
        <textarea ref=${notesRef} class="input textarea" rows="2" value=${notes} placeholder="Extra detail for Kantata, e.g. Walked Jamie through the cost code import"
          onInput=${(e) => setNotes(e.currentTarget.value)}></textarea>
      <//>

      ${editing && html`<${Switch} checked=${entered} onChange=${setEntered} label="Entered in Kantata" hint="Mark this once you've copied it into your Kantata time entry." />`}

      ${preview && html`<div class=${cx('kantata-preview', !type && 'is-empty')}>
        <div class="kp-label"><${Icon} name="clipboard-list" size=${14} /> Kantata line</div>
        <div class="kp-line">${type ? preview : 'Pick an action to preview the line you will paste into Kantata.'}</div>
        ${type && html`<${CopyButton} compact text=${preview} onCopy=${(t) => copyText(t)} label="Copy line" />`}
      </div>`}
      </div>
    </div>
  <//>`;
}

// Searchable client dropdown. Recently used clients float to the top, and a
// new client can be created straight from the search box.
export function ClientPicker({ value, onChange, clients, entries }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const wrap = useRef(null);
  const search = useRef(null);
  const selected = value ? clients.find((c) => c.id === value) : null;

  const recency = useMemo(() => {
    const map = {};
    for (const e of entries) if (e.clientId) map[e.clientId] = Math.max(map[e.clientId] || 0, new Date(e.start).getTime());
    return map;
  }, [entries]);

  const options = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let list = clients.filter((c) => (ql ? `${c.name} ${c.kantataProject || ''}`.toLowerCase().includes(ql) : c.active));
    list = list.sort((a, b) => (Number(b.active) - Number(a.active)) || ((recency[b.id] || 0) - (recency[a.id] || 0)) || a.name.localeCompare(b.name));
    const opts = [];
    if (!ql || 'internal no client'.includes(ql)) opts.push({ id: null, name: 'Internal / no client', internal: true });
    opts.push(...list);
    if (ql && !clients.some((c) => c.name.toLowerCase() === ql)) opts.push({ create: true, name: q.trim() });
    return opts;
  }, [q, clients, recency]);

  useEffect(() => setHi(0), [q, open]);
  useEffect(() => {
    if (!open) return undefined;
    setTimeout(() => search.current?.focus(), 0);
    const close = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const choose = (o) => {
    if (o.create) {
      const c = addClient({ name: o.name, color: PALETTE[clients.length % PALETTE.length] });
      onChange(c.id);
      toast(`Added client · ${c.name}`, { icon: 'building-2' });
    } else {
      onChange(o.id);
    }
    setOpen(false);
    setQ('');
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(options.length - 1, h + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
    else if (e.key === 'Enter' && !e.ctrlKey) { e.preventDefault(); if (options[hi]) choose(options[hi]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); }
  };

  return html`<div class="picker" ref=${wrap}>
    <button type="button" class=${cx('input picker-trigger', open && 'is-open')} onClick=${() => setOpen(!open)}>
      ${selected
        ? html`<${ClientAvatar} client=${selected} size=${28} /><span class="picker-value">${selected.name}</span>
          ${selected.kantataProject && html`<span class="picker-sub">${selected.kantataProject}</span>`}`
        : value === null
          ? html`<span class="picker-icon"><${Icon} name="briefcase" size=${15} /></span><span class="picker-value">Internal / no client</span>`
          : html`<span class="picker-icon"><${Icon} name="building-2" size=${15} /></span>
            <span class="picker-placeholder">${clients.length ? 'Choose a client…' : 'Type to add your first client…'}</span>`}
      <${Icon} name="chevron-down" size=${16} class="picker-caret" />
    </button>
    ${open && html`<div class="picker-pop">
      <div class="picker-search">
        <${Icon} name="search" size=${16} />
        <input ref=${search} value=${q} placeholder="Search or add a client…" onInput=${(e) => setQ(e.currentTarget.value)} onKeyDown=${onKey} />
      </div>
      <div class="picker-list">
        ${options.map((o, i) => html`<button type="button" class=${cx('picker-opt', i === hi && 'is-hi', o.id === value && !o.create && 'is-selected')}
            onMouseEnter=${() => setHi(i)} onClick=${() => choose(o)}>
          ${o.create
            ? html`<span class="picker-plus"><${Icon} name="plus" size=${15} /></span><span>Add <b>“${o.name}”</b> as a new client</span>`
            : o.internal
              ? html`<span class="picker-icon"><${Icon} name="briefcase" size=${15} /></span><span>Internal / no client</span>`
              : html`<${ClientAvatar} client=${o} size=${26} />
                <span class="picker-opt-name">${o.name}</span>
                ${!o.active && html`<span class="badge badge-muted">Inactive</span>`}
                ${o.kantataProject && html`<span class="picker-sub">${o.kantataProject}</span>`}`}
          ${o.id === value && !o.create && html`<${Icon} name="check" size=${15} class="picker-check" />`}
        </button>`)}
        ${options.length === 0 && html`<div class="picker-empty">No clients yet. Type a name to add one.</div>`}
      </div>
    </div>`}
  </div>`;
}
