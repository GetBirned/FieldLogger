// Calendar dashboard: day / week time grid, month overview and a side panel
// with a mini calendar, period stats and quick-log buttons.
import { html, useEffect, useLayoutEffect, useMemo, useRef, useState } from '../lib/h.js';
import { useSession, useUi, setUi, openLog, openEdit, nav } from '../lib/store.js';
import {
  dateKey, todayKey, parseKey, addDays, addMonths, startOfMonth, weekDays, monthGrid, minutesOfDay,
  fmtTime, fmtRange, fmtHourLabel, fmtDuration, fmtHours, fmtDateFull, fmtDateLong, fmtWeekRange, fmtMonthYear, fmtWeekday,
} from '../lib/time.js';
import { entryMinutes, totalMinutes } from '../lib/notes.js';
import { Button, ClientAvatar, Icon, IconButton, Segmented, TypeBadge, cx } from './ui.js';

const HOUR_H = { compact: 46, comfortable: 62, spacious: 82 };
const INSTANT_PX = 26;
const MIN_RANGE_PX = 24;

const isTyping = (e) => {
  const t = e.target;
  return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
};

export function CalendarView() {
  const { data } = useSession();
  const u = useUi();
  const s = data.settings;
  const date = parseKey(u.date);
  const view = u.calView;

  const typeById = useMemo(() => Object.fromEntries(data.actionTypes.map((t) => [t.id, t])), [data.actionTypes]);
  const clientById = useMemo(() => Object.fromEntries(data.clients.map((c) => [c.id, c])), [data.clients]);
  const days = view === 'day' ? [date] : view === 'week' ? weekDays(date, s.weekStart, s.showWeekends) : null;

  const step = (dir) => {
    if (view === 'day') setUi({ date: dateKey(addDays(date, dir)) });
    else if (view === 'week') setUi({ date: dateKey(addDays(date, 7 * dir)) });
    else setUi({ date: dateKey(addMonths(date, dir)) });
  };

  useEffect(() => {
    const onKey = (e) => {
      if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('.modal-layer')) return;
      const k = e.key.toLowerCase();
      if (k === 'arrowleft') step(-1);
      else if (k === 'arrowright') step(1);
      else if (k === 't') setUi({ date: todayKey() });
      else if (k === 'd') setUi({ calView: 'day' });
      else if (k === 'w') setUi({ calView: 'week' });
      else if (k === 'm') setUi({ calView: 'month' });
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const title = view === 'day' ? fmtDateFull(date) : view === 'week' ? fmtWeekRange(days) : fmtMonthYear(date);
  const isCurrent = view === 'day' ? u.date === todayKey()
    : view === 'week' ? days.some((d) => dateKey(d) === todayKey()) || weekDays(date, s.weekStart, true).some((d) => dateKey(d) === todayKey())
      : date.getMonth() === new Date().getMonth() && date.getFullYear() === new Date().getFullYear();

  return html`<div class="cal-layout">
    <section class="card cal-main">
      <div class="cal-toolbar">
        <div class="cal-nav">
          <${Button} size="sm" variant=${isCurrent ? 'secondary' : 'accent-soft'} onClick=${() => setUi({ date: todayKey() })} data-tip="Jump to today (T)">Today<//>
          <div class="cal-arrows">
            <${IconButton} icon="chevron-left" label="Previous (←)" onClick=${() => step(-1)} />
            <${IconButton} icon="chevron-right" label="Next (→)" onClick=${() => step(1)} />
          </div>
          <h2 class="cal-title">${title}</h2>
        </div>
        <${Segmented} value=${view} onChange=${(v) => setUi({ calView: v })} options=${[
          { value: 'day', label: 'Day', tip: 'Day (D)' },
          { value: 'week', label: 'Week', tip: 'Week (W)' },
          { value: 'month', label: 'Month', tip: 'Month (M)' },
        ]} />
      </div>
      ${view === 'month'
        ? html`<${MonthView} date=${date} data=${data} typeById=${typeById} clientById=${clientById} />`
        : html`<${TimeGrid} days=${days} view=${view} data=${data} typeById=${typeById} clientById=${clientById} />`}
    </section>
    <${SidePanel} view=${view} date=${date} data=${data} typeById=${typeById} clientById=${clientById} />
  </div>`;
}

export function entryColor(entry, settings, typeById, clientById) {
  if (settings.colorBy === 'client') return clientById[entry.clientId]?.color || '#64748b';
  return typeById[entry.typeId]?.color || '#64748b';
}

// Assigns overlapping items to side-by-side columns.
function layoutColumns(items) {
  const sorted = items.slice().sort((a, b) => a.s - b.s || b.e - a.e);
  const out = [];
  let cluster = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    const cols = [];
    for (const it of cluster) {
      let c = cols.findIndex((end) => end <= it.s);
      if (c === -1) { c = cols.length; cols.push(it.e); } else cols[c] = it.e;
      it.col = c;
    }
    for (const it of cluster) it.cols = cols.length;
    out.push(...cluster);
    cluster = [];
  };
  for (const it of sorted) {
    if (cluster.length && it.s >= clusterEnd) { flush(); clusterEnd = -Infinity; }
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.e);
  }
  if (cluster.length) flush();
  return out;
}

function useNow(ms = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function TimeGrid({ days, view, data, typeById, clientById }) {
  const s = data.settings;
  const hourH = HOUR_H[s.density] || HOUR_H.comfortable;
  const keys = days.map(dateKey);
  const keySig = keys.join(',');
  const now = useNow();
  const today = dateKey(now);
  const scrollRef = useRef(null);
  const [drag, setDrag] = useState(null);

  const byDay = useMemo(() => {
    const map = Object.fromEntries(keys.map((k) => [k, []]));
    for (const e of data.entries) {
      const k = dateKey(new Date(e.start));
      if (map[k]) map[k].push(e);
    }
    return map;
  }, [data.entries, keySig]);

  // Grow the visible hours to fit anything logged outside the normal workday.
  let minH = Math.max(0, Math.min(23, Number(s.dayStart)));
  let maxH = Math.min(24, Math.max(minH + 1, Number(s.dayEnd)));
  for (const k of keys) {
    for (const e of byDay[k]) {
      const st = new Date(e.start);
      minH = Math.min(minH, st.getHours());
      const endMin = e.end && dateKey(new Date(e.end)) === k ? minutesOfDay(new Date(e.end)) : minutesOfDay(st) + 30;
      maxH = Math.max(maxH, Math.min(24, Math.ceil(endMin / 60)));
    }
  }
  if (keys.includes(today)) {
    minH = Math.min(minH, now.getHours());
    maxH = Math.max(maxH, Math.min(24, now.getHours() + 1));
  }
  const hours = Array.from({ length: maxH - minH + 1 }, (_, i) => minH + i);
  const height = (maxH - minH) * hourH;
  const yOf = (min) => ((min - minH * 60) / 60) * hourH;

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let targetMin;
    if (keys.includes(today)) targetMin = minutesOfDay(now) - 120;
    else {
      const first = keys.flatMap((k) => byDay[k]).map((e) => minutesOfDay(new Date(e.start))).sort((a, b) => a - b)[0];
      targetMin = first != null ? first - 45 : (Number(s.dayStart) + 1) * 60;
    }
    el.scrollTop = Math.max(0, yOf(targetMin));
  }, [keySig, view, hourH]);

  const startDrag = (e, key) => {
    if (e.button !== 0 || e.target.closest('.ev')) return;
    const col = e.currentTarget;
    const rect = col.getBoundingClientRect();
    const minAt = (y) => Math.min(maxH * 60, Math.max(minH * 60, minH * 60 + ((y - rect.top) / hourH) * 60));
    const anchor = Math.floor(minAt(e.clientY) / 15) * 15;
    const startY = e.clientY;
    let moved = false;
    const rangeFor = (y) => {
      const p = minAt(y);
      if (p >= anchor) return [anchor, Math.max(anchor + 15, Math.ceil(p / 15) * 15)];
      return [Math.floor(p / 15) * 15, anchor + 15];
    };
    col.setPointerCapture(e.pointerId);
    setDrag({ key, a: anchor, b: anchor + 30 });
    const move = (ev) => {
      if (Math.abs(ev.clientY - startY) > 5) moved = true;
      if (moved) {
        const [a, b] = rangeFor(ev.clientY);
        setDrag({ key, a, b });
      }
    };
    const up = (ev) => {
      col.removeEventListener('pointermove', move);
      col.removeEventListener('pointerup', up);
      col.removeEventListener('pointercancel', cancel);
      const [a, b] = moved ? rangeFor(ev.clientY) : [anchor, Math.min(24 * 60, anchor + 30)];
      setDrag(null);
      openLog({ mode: 'range', dateKey: key, startMin: a, endMin: b });
    };
    const cancel = () => {
      col.removeEventListener('pointermove', move);
      col.removeEventListener('pointerup', up);
      col.removeEventListener('pointercancel', cancel);
      setDrag(null);
    };
    col.addEventListener('pointermove', move);
    col.addEventListener('pointerup', up);
    col.addEventListener('pointercancel', cancel);
  };

  const multi = days.length > 1;
  const cols = `var(--gutter) repeat(${days.length}, minmax(0, 1fr))`;
  const anyEntries = keys.some((k) => byDay[k].length);

  return html`<div class=${cx('tg', multi && 'tg-multi')} style=${{ '--hour-h': `${hourH}px` }}>
    ${multi && html`<div class="tg-head" style=${{ gridTemplateColumns: cols }}>
      <div class="tg-head-gutter"></div>
      ${days.map((d) => {
        const k = dateKey(d);
        const mins = totalMinutes(byDay[k]);
        return html`<button type="button" class=${cx('tg-day', k === today && 'is-today')} onClick=${() => setUi({ date: k, calView: 'day' })}>
          <span class="tg-dow">${fmtWeekday(d)}</span>
          <span class="tg-date">${d.getDate()}</span>
          <span class=${cx('tg-hours', !mins && 'is-empty')}>${mins ? `${fmtHours(mins / 60)}h` : '—'}</span>
        </button>`;
      })}
    </div>`}
    <div class="tg-scroll" ref=${scrollRef}>
      <div class="tg-body" style=${{ gridTemplateColumns: cols, height: `${height + 24}px` }}>
        <div class="tg-gutter">
          ${hours.map((h) => {
            const hiddenByNow = keys.includes(today) && Math.abs(h * 60 - minutesOfDay(now)) < 15;
            return html`<span class="tg-hour" style=${{ top: `${(h - minH) * hourH}px` }}>${h < 24 && !hiddenByNow ? fmtHourLabel(h, s.hour12) : ''}</span>`;
          })}
          ${keys.includes(today) && html`<span class="tg-now-label" style=${{ top: `${yOf(minutesOfDay(now))}px` }}>${fmtTime(now, s.hour12).replace(/ (AM|PM)$/, '')}</span>`}
        </div>
        ${days.map((d) => {
          const k = dateKey(d);
          const items = layoutColumns(byDay[k].map((e) => {
            const st = minutesOfDay(new Date(e.start));
            const instant = !e.end;
            let en = instant ? st : (dateKey(new Date(e.end)) === k ? minutesOfDay(new Date(e.end)) : 24 * 60);
            const minPx = instant ? INSTANT_PX : MIN_RANGE_PX;
            en = Math.max(en, st + (minPx / hourH) * 60);
            return { s: st, e: en, entry: e, instant };
          }));
          return html`<div class=${cx('tg-col', k === today && 'is-today', [0, 6].includes(d.getDay()) && 'is-weekend')}
              onPointerDown=${(ev) => startDrag(ev, k)} style=${{ height: `${height}px` }}>
            ${items.map((it) => html`<${EventBlock} key=${it.entry.id} item=${it} top=${yOf(it.s)} height=${((it.e - it.s) / 60) * hourH}
              data=${data} typeById=${typeById} clientById=${clientById} narrow=${multi} />`)}
            ${drag && drag.key === k && html`<div class="tg-ghost" style=${{ top: `${yOf(drag.a)}px`, height: `${((drag.b - drag.a) / 60) * hourH}px` }}>
              <span>${fmtRange(parseKeyMin(k, drag.a), parseKeyMin(k, drag.b), s.hour12)}</span>
              <span class="tg-ghost-dur">${fmtDuration(drag.b - drag.a)}</span>
            </div>`}
            ${k === today && html`<div class="now-line" style=${{ top: `${yOf(minutesOfDay(now))}px` }}><span class="now-dot"></span></div>`}
          </div>`;
        })}
      </div>
      ${!anyEntries && !multi && html`<div class="tg-hint">
        <${Icon} name="mouse-pointer-click" size=${16} />
        <span>Nothing logged yet. Click <b>Log Action</b>, or click and drag on the grid to log a time range.</span>
      </div>`}
    </div>
  </div>`;
}

const parseKeyMin = (key, min) => {
  const d = parseKey(key);
  d.setMinutes(min);
  return d;
};

function EventBlock({ item, top, height, data, typeById, clientById, narrow }) {
  const e = item.entry;
  const s = data.settings;
  const type = typeById[e.typeId];
  const client = clientById[e.clientId];
  const color = entryColor(e, s, typeById, clientById);
  const timeText = e.end ? fmtRange(e.start, e.end, s.hour12) : fmtTime(e.start, s.hour12);
  const mins = entryMinutes(e);
  const style = {
    top: `${top}px`,
    height: `${height}px`,
    left: `calc(${(item.col / item.cols) * 100}% + 3px)`,
    width: `calc(${100 / item.cols}% - 6px)`,
    '--ev': color,
  };
  const tip = `${type?.name || 'Action'} · ${client?.name || 'Internal'} · ${timeText}${e.notes ? `\n${e.notes}` : ''}`;
  const logo = client?.logo && html`<${ClientAvatar} client=${client} size=${16} class="ev-logo" />`;
  const clientLabel = html`<span class="ev-client">${logo}<span class="ev-client-name">${client?.name || 'Internal'}</span></span>`;

  if (item.instant) {
    return html`<button type="button" class=${cx('ev ev-instant', e.entered && 'is-entered')} style=${style} title=${tip}
        onClick=${() => openEdit(e.id)} onPointerDown=${(ev) => ev.stopPropagation()}>
      <span class="ev-dot"></span>
      <span class="ev-time">${narrow ? fmtTime(e.start, s.hour12).replace(/ (AM|PM)$/, (m) => m.trim()[0].toLowerCase()) : fmtTime(e.start, s.hour12)}</span>
      <span class="ev-title">${type?.name || 'Action'}</span>
      ${!narrow && clientLabel}
      ${!narrow && mins > 0 && html`<span class="ev-dur">${fmtDuration(mins)}</span>`}
      ${e.entered && html`<span class="ev-check" title="Entered in Kantata"><${Icon} name="check" size=${11} stroke=${3} /></span>`}
    </button>`;
  }

  const compact = height < 46;
  const wide = !narrow && item.cols === 1;
  return html`<button type="button" class=${cx('ev ev-range', compact && 'ev-compact', e.entered && 'is-entered')} style=${style} title=${tip}
      onClick=${() => openEdit(e.id)} onPointerDown=${(ev) => ev.stopPropagation()}>
    <div class="ev-row">
      <${Icon} name=${type?.icon || 'circle-dot'} size=${13} class="ev-icon" />
      ${narrow && compact && logo}
      <span class="ev-title">${type?.name || 'Action'}</span>
      ${compact && !narrow && clientLabel}
      ${wide && html`<span class="ev-time ev-time-end">${timeText} · ${fmtDuration(mins)}</span>`}
      ${e.entered && html`<span class="ev-check" title="Entered in Kantata"><${Icon} name="check" size=${11} stroke=${3} /></span>`}
    </div>
    ${!compact && clientLabel}
    ${!compact && !wide && height >= 56 && html`<div class="ev-time">${timeText}</div>`}
    ${!compact && height > 80 && e.notes && html`<div class="ev-notes">${e.notes}</div>`}
  </button>`;
}

function MonthView({ date, data, typeById, clientById }) {
  const s = data.settings;
  const u = useUi();
  const grid = monthGrid(date, s.weekStart);
  const today = todayKey();
  const byDay = useMemo(() => {
    const map = {};
    for (const e of data.entries) {
      const k = dateKey(new Date(e.start));
      (map[k] ||= []).push(e);
    }
    for (const k in map) map[k].sort((a, b) => new Date(a.start) - new Date(b.start));
    return map;
  }, [data.entries]);

  return html`<div class="month">
    <div class="month-dow">${grid.slice(0, 7).map((d) => html`<span>${fmtWeekday(d)}</span>`)}</div>
    <div class="month-grid">
      ${grid.map((d) => {
        const k = dateKey(d);
        const list = byDay[k] || [];
        const mins = totalMinutes(list);
        return html`<button type="button" class=${cx('mcell', d.getMonth() !== date.getMonth() && 'is-other', k === today && 'is-today', k === u.date && 'is-selected')}
            onClick=${() => setUi({ date: k, calView: 'day' })}>
          <div class="mcell-head">
            <span class="mcell-num">${d.getDate()}</span>
            ${list.length > 2 && html`<span class="mmore" title=${`${list.length} entries`}>+${list.length - 2}</span>`}
            ${mins > 0 && html`<span class="mcell-hours">${fmtHours(mins / 60)}h</span>`}
          </div>
          <div class="mcell-list">
            ${list.slice(0, 2).map((e) => html`<div class="mpill" style=${{ '--ev': entryColor(e, s, typeById, clientById) }}
                title=${`${fmtTime(e.start, s.hour12)} · ${typeById[e.typeId]?.name || 'Action'} · ${clientById[e.clientId]?.name || 'Internal'}`}>
              <span class="mpill-dot"></span>
              <span class="mpill-name">${typeById[e.typeId]?.name || 'Action'}</span>
            </div>`)}
          </div>
        </button>`;
      })}
    </div>
  </div>`;
}

function SidePanel({ view, date, data, typeById, clientById }) {
  const s = data.settings;
  const u = useUi();
  const key = dateKey(date);
  const today = todayKey();

  const { entries, label } = useMemo(() => {
    if (view === 'day') {
      return { entries: data.entries.filter((e) => dateKey(new Date(e.start)) === key), label: key === today ? 'Today' : fmtDateLong(date) };
    }
    if (view === 'week') {
      const set = new Set(weekDays(date, s.weekStart, true).map(dateKey));
      return { entries: data.entries.filter((e) => set.has(dateKey(new Date(e.start)))), label: set.has(today) ? 'This week' : `Week of ${fmtWeekRange(weekDays(date, s.weekStart, true)).split(',')[0]}` };
    }
    const m = date.getMonth();
    const y = date.getFullYear();
    return { entries: data.entries.filter((e) => { const d = new Date(e.start); return d.getMonth() === m && d.getFullYear() === y; }), label: fmtMonthYear(date) };
  }, [view, key, data.entries, s.weekStart]);

  const minutes = totalMinutes(entries);
  const entered = entries.filter((e) => e.entered).length;
  const byClient = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      const id = e.clientId || '_internal';
      map.set(id, (map.get(id) || 0) + entryMinutes(e));
    }
    return [...map.entries()]
      .map(([id, mins]) => ({ id, mins, client: clientById[id] }))
      .filter((x) => x.mins > 0)
      .sort((a, b) => b.mins - a.mins);
  }, [entries, clientById]);

  const quickTypes = data.actionTypes.filter((t) => !t.archived).slice(0, 8);
  const quickPrefill = (typeId) => (key === today ? { typeId } : { typeId, dateKey: key });

  return html`<aside class="cal-side">
    <div class="card side-card"><${MiniCalendar} date=${date} entries=${data.entries} weekStart=${s.weekStart} selected=${u.date} /></div>

    <div class="card side-card">
      <div class="side-head"><span class="eyebrow">${label}</span><span class="side-count">${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}</span></div>
      <div class="stat-row">
        <div class="stat-big">${fmtHours(minutes / 60)}<small>h</small></div>
        <div class="stat-side">
          <span class="stat-pill" data-tip="Entries marked as entered in Kantata"><${Icon} name="clipboard-check" size=${13} /> ${entered}/${entries.length} entered</span>
        </div>
      </div>
      ${byClient.length > 0 && html`<div class="stack-bar">
        ${byClient.map((x) => html`<span style=${{ flexGrow: x.mins, background: x.client?.color || 'var(--faint)' }} title=${`${x.client?.name || 'Internal'} · ${fmtHours(x.mins / 60)}h`}></span>`)}
      </div>
      <ul class="legend">
        ${byClient.slice(0, 5).map((x) => html`<li>
          <span class="legend-dot" style=${{ background: x.client?.color || 'var(--faint)' }}></span>
          <span class="legend-name">${x.client?.name || 'Internal'}</span>
          <span class="legend-val">${fmtHours(x.mins / 60)}h</span>
        </li>`)}
      </ul>`}
      ${!entries.length && html`<p class="side-empty">No time logged ${view === 'day' ? 'on this day' : `this ${view}`} yet.</p>`}
      <${Button} variant="primary" icon="sparkles" class="w-full" onClick=${() => nav('notes', { date: u.date })}>Generate Kantata notes<//>
    </div>

    <div class="card side-card">
      <div class="side-head"><span class="eyebrow">Quick log</span><span class="side-count">${key === today ? 'stamped now' : fmtDateLong(date)}</span></div>
      <div class="quick-grid">
        ${quickTypes.map((t) => html`<button type="button" class="quick" style=${{ '--tc': t.color }} onClick=${() => openLog(quickPrefill(t.id))}>
          <${TypeBadge} type=${t} size=${28} />
          <span>${t.name}</span>
        </button>`)}
      </div>
    </div>
  </aside>`;
}

function MiniCalendar({ date, entries, weekStart, selected }) {
  const [month, setMonth] = useState(() => startOfMonth(date));
  const sig = `${date.getFullYear()}-${date.getMonth()}`;
  useEffect(() => setMonth(startOfMonth(date)), [sig]);
  const grid = monthGrid(month, weekStart);
  const has = useMemo(() => new Set(entries.map((e) => dateKey(new Date(e.start)))), [entries]);
  const today = todayKey();
  return html`<div class="mini">
    <div class="mini-head">
      <span class="mini-title">${fmtMonthYear(month)}</span>
      <div class="mini-arrows">
        <${IconButton} icon="chevron-left" label="Previous month" size=${15} onClick=${() => setMonth(addMonths(month, -1))} />
        <${IconButton} icon="chevron-right" label="Next month" size=${15} onClick=${() => setMonth(addMonths(month, 1))} />
      </div>
    </div>
    <div class="mini-grid">
      ${grid.slice(0, 7).map((d) => html`<span class="mini-dow">${fmtWeekday(d, 'narrow')}</span>`)}
      ${grid.map((d) => {
        const k = dateKey(d);
        return html`<button type="button" class=${cx('mini-day', d.getMonth() !== month.getMonth() && 'is-other', k === today && 'is-today', k === selected && 'is-selected', has.has(k) && 'has-dot')}
          onClick=${() => setUi({ date: k })}>${d.getDate()}</button>`;
      })}
    </div>
  </div>`;
}
