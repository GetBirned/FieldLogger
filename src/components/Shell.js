// App frame: sidebar navigation, top bar (title, timer, Log Action) and the
// global overlays (log dialog, confirm dialog, toasts).
import { html, useEffect, useMemo, useState } from '../lib/h.js';
import { useSession, useUi, nav, openLog, setSettings, signOut, lock, stopTimer, discardTimer, toast, closeConfirm, dismissToast } from '../lib/store.js';
import { isElectron } from '../lib/bridge.js';
import { entriesOnDay, totalMinutes } from '../lib/notes.js';
import { todayKey, greeting, fmtDateLong, fmtClock, fmtHours, fmtDuration } from '../lib/time.js';
import { LogoMark, Wordmark } from './Logo.js';
import { Avatar, Button, Icon, IconButton, Kbd, Menu, Modal, Ring, TypeBadge, cx } from './ui.js';
import { CalendarView } from './Calendar.js';
import { ClientsView } from './Clients.js';
import { NotesView } from './Notes.js';
import { SettingsView } from './Settings.js';
import { LogModal } from './LogModal.js';

const NAV = [
  { id: 'calendar', label: 'Calendar', icon: 'calendar-days', key: '1' },
  { id: 'clients', label: 'Clients', icon: 'building-2', key: '2' },
  { id: 'notes', label: 'Notes', icon: 'clipboard-list', key: '3' },
  { id: 'settings', label: 'Settings', icon: 'settings', key: '4' },
];

export function Shell() {
  const { profile, data, readOnly } = useSession();
  const u = useUi();
  const collapsed = data.settings.sidebarCollapsed;

  return html`<div class=${cx('shell', collapsed && 'is-collapsed', isElectron && 'is-electron')}>
    <${Sidebar} profile=${profile} data=${data} page=${u.page} collapsed=${collapsed} />
    <main class="main">
      <${Topbar} page=${u.page} data=${data} profile=${profile} />
      ${readOnly && html`<div class="readonly-banner" role="status">
        <${Icon} name="lock" size=${15} />
        <span>Read-only. This data was saved by a newer version of FieldLogger, so this version won't change it. Install the latest version to keep working.</span>
      </div>`}
      <div class="page" key=${u.page}>
        ${u.page === 'calendar' && html`<${CalendarView} />`}
        ${u.page === 'clients' && html`<${ClientsView} />`}
        ${u.page === 'notes' && html`<${NotesView} />`}
        ${u.page === 'settings' && html`<${SettingsView} />`}
      </div>
    </main>
    ${u.log && html`<${LogModal} state=${u.log} />`}
    ${u.confirm && html`<${ConfirmDialog} confirm=${u.confirm} />`}
    <${Toasts} toasts=${u.toasts} />
  </div>`;
}

function Sidebar({ profile, data, page, collapsed }) {
  const today = todayKey();
  const todayEntries = useMemo(() => entriesOnDay(data.entries, today), [data.entries, today]);
  const todayHours = totalMinutes(todayEntries) / 60;
  const pending = todayEntries.filter((e) => !e.entered).length;
  const activeClients = data.clients.filter((c) => c.active).length;
  const target = Number(data.settings.dailyTarget) || 8;

  const badges = { clients: activeClients || null, notes: pending || null };

  return html`<aside class="sidebar">
    <div class="sidebar-brand">
      <${LogoMark} size=${34} />
      ${!collapsed && html`<${Wordmark} size=${19} />`}
    </div>
    <nav class="sidebar-nav">
      ${NAV.map((n) => html`<button type="button" class=${cx('nav-item', page === n.id && 'is-active')}
          onClick=${() => nav(n.id, n.id === 'clients' ? { clientId: null } : {})} data-tip=${collapsed ? n.label : null}>
        <${Icon} name=${n.icon} size=${19} />
        ${!collapsed && html`<span class="nav-label">${n.label}</span>`}
        ${badges[n.id] && html`<span class=${cx('nav-badge', n.id === 'notes' && 'is-accent')}>${badges[n.id]}</span>`}
      </button>`)}
    </nav>

    <div class="sidebar-spacer"></div>

    <button type="button" class="today-card" onClick=${() => nav('notes', { date: today })} data-tip=${collapsed ? `${fmtHours(todayHours)}h of ${target}h today` : null}>
      <${Ring} value=${todayHours} max=${target} size=${collapsed ? 40 : 46} stroke=${5}>
        <span class="ring-num">${Math.round((todayHours / target) * 100)}<small>%</small></span>
      <//>
      ${!collapsed && html`<div class="today-text">
        <span class="today-label">Today</span>
        <span class="today-value">${fmtHours(todayHours)}h <span class="muted">of ${target}h</span></span>
        <span class="today-sub">${todayEntries.length} ${todayEntries.length === 1 ? 'entry' : 'entries'}${pending ? ` · ${pending} to enter` : ''}</span>
      </div>`}
    </button>

    <div class="sidebar-foot">
      <${Menu} align="up" trigger=${({ toggle }) => html`<button type="button" class="profile-chip" onClick=${toggle}>
          <${Avatar} name=${profile.name} color=${profile.color} src=${profile.photo} size=${34} />
          ${!collapsed && html`<span class="profile-chip-text"><span class="profile-chip-name">${profile.name}</span><span class="profile-chip-role">${profile.role || 'Consultant'}</span></span>`}
          ${!collapsed && html`<${Icon} name="chevron-up" size=${16} class="muted" />`}
        </button>`}
        items=${[
          { label: 'Profile, photo & PIN', icon: 'user-round', run: () => nav('settings', { settingsTab: 'profile' }) },
          { label: 'Appearance', icon: 'palette', run: () => nav('settings', { settingsTab: 'appearance' }) },
          '-',
          profile.hasPin && { label: 'Lock', icon: 'lock', run: lock },
          { label: 'Switch profile', icon: 'log-out', run: signOut },
        ]} />
      <${IconButton} icon="panel-left" label=${collapsed ? 'Expand sidebar' : 'Collapse sidebar'} class="collapse-btn"
        onClick=${() => setSettings({ sidebarCollapsed: !collapsed })} />
    </div>
  </aside>`;
}

function Topbar({ page, data, profile }) {
  const titles = {
    calendar: [`${greeting()}, ${profile.name.split(' ')[0]}`, fmtDateLong(new Date())],
    clients: ['Clients', `${data.clients.filter((c) => c.active).length} active · ${data.clients.filter((c) => !c.active).length} inactive`],
    notes: ['Notes', 'Copy-ready lines for your time entries'],
    settings: ['Settings', 'Make FieldLogger yours'],
  };
  const [title, sub] = titles[page] || ['', ''];
  return html`<header class="topbar">
    <div class="topbar-titles">
      <h1>${title}</h1>
      <p>${sub}</p>
    </div>
    <div class="topbar-actions">
      ${data.timer && html`<${TimerChip} data=${data} />`}
      <button type="button" class="btn btn-primary btn-log" onClick=${() => openLog()} data-tip="Log Action (Ctrl+L)">
        <${Icon} name="plus" size=${18} stroke=${2.4} /><span>Log Action</span><${Kbd}>Ctrl L<//>
      </button>
    </div>
  </header>`;
}

function TimerChip({ data }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const timer = data.timer;
  const type = data.actionTypes.find((t) => t.id === timer.typeId);
  const client = data.clients.find((c) => c.id === timer.clientId);
  const elapsed = Date.now() - new Date(timer.start).getTime();

  const stop = () => {
    const entry = stopTimer();
    if (entry) toast(`Logged ${fmtDuration((new Date(entry.end) - new Date(entry.start)) / 60000)} · ${type?.name || 'Action'}`, { icon: 'circle-check' });
  };

  return html`<div class="timer-chip" style=${{ '--tc': type?.color || 'var(--accent)' }}>
    <span class="timer-pulse"></span>
    <${TypeBadge} type=${type} size=${26} />
    <div class="timer-text">
      <span class="timer-name">${type?.name || 'Timer'}</span>
      <span class="timer-client">${client?.name || 'Internal'}</span>
    </div>
    <span class="timer-clock">${fmtClock(elapsed)}</span>
    <button type="button" class="timer-stop" onClick=${stop} data-tip="Stop & log"><${Icon} name="square" size=${13} stroke=${3} /></button>
    <button type="button" class="timer-discard" onClick=${() => { discardTimer(); toast('Timer discarded', { tone: 'info', icon: 'x' }); }} data-tip="Discard timer"><${Icon} name="x" size=${14} /></button>
  </div>`;
}

function ConfirmDialog({ confirm }) {
  return html`<${Modal} title=${confirm.title} icon=${confirm.icon || (confirm.danger ? 'triangle-alert' : 'circle-help')} onClose=${() => closeConfirm(false)} width=${440}
    class=${confirm.danger ? 'modal-danger' : ''}
    footer=${html`
      <${Button} variant="ghost" onClick=${() => closeConfirm(false)}>${confirm.cancelLabel || 'Cancel'}<//>
      <${Button} variant=${confirm.danger ? 'danger' : 'primary'} onClick=${() => closeConfirm(true)} autofocus>${confirm.confirmLabel || 'Confirm'}<//>
    `}>
    <p class="confirm-text">${confirm.message}</p>
  <//>`;
}

function Toasts({ toasts }) {
  return html`<div class="toasts" aria-live="polite">
    ${toasts.map((t) => html`<div key=${t.id} class=${cx('toast', `toast-${t.tone}`)}>
      <${Icon} name=${t.icon || (t.tone === 'error' ? 'triangle-alert' : t.tone === 'info' ? 'info' : 'circle-check')} size=${17} />
      <span class="toast-msg">${t.message}</span>
      ${t.action && html`<button type="button" class="toast-action" onClick=${() => { t.action.run(); dismissToast(t.id); }}>${t.action.label}</button>`}
      <button type="button" class="toast-x" onClick=${() => dismissToast(t.id)} aria-label="Dismiss"><${Icon} name="x" size=${14} /></button>
    </div>`)}
  </div>`;
}
