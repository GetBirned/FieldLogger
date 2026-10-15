// Settings: appearance, action types, note format, calendar, profile, data.
import { html, useEffect, useMemo, useState } from '../lib/h.js';
import {
  useSession, useUi, setUi, setSettings, saveActionType, deleteActionType, moveActionType, restoreDefaultActionTypes,
  updateProfile, setProfilePin, signOut, lock, replaceData, reloadData, loadDemo, removeDemo, confirmDialog, toast, flush,
} from '../lib/store.js';
import { processPhoto } from '../lib/image.js';
import { bridge, isElectron } from '../lib/bridge.js';
import { ACCENTS, BRAND_PALETTES, ACTION_ICONS, NOTE_TOKENS, DEFAULT_TEMPLATE, PALETTE, APP_NAME, isNewerData, uid } from '../lib/defaults.js';
import { renderLine } from '../lib/notes.js';
import { fmtHourLabel, fmtDateLong, parseKey } from '../lib/time.js';
import { CHANGELOG, LATEST_VERSION } from '../lib/changelog.js';
import { Avatar, Button, ColorPicker, Field, Icon, IconButton, ImageDrop, Kbd, Modal, Segmented, Switch, TypeBadge, cx, usePasteImage } from './ui.js';
import { LogoMark, Wordmark } from './Logo.js';
import { BackupList } from './Backups.js';

const TABS = [
  { id: 'appearance', label: 'Appearance', icon: 'palette' },
  { id: 'types', label: 'Action types', icon: 'layout-grid' },
  { id: 'notes', label: 'Kantata notes', icon: 'clipboard-list' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar-days' },
  { id: 'profile', label: 'Profile & PIN', icon: 'user-round' },
  { id: 'data', label: 'Data & backup', icon: 'database' },
  { id: 'updates', label: 'Update log', icon: 'history' },
  { id: 'about', label: 'Shortcuts & about', icon: 'keyboard' },
];

export function SettingsView() {
  const u = useUi();
  const { data, profile } = useSession();
  const tab = u.settingsTab || 'appearance';
  return html`<div class="settings">
    <nav class="settings-nav card">
      ${TABS.map((t) => html`<button type="button" class=${cx('settings-tab', tab === t.id && 'is-active')} onClick=${() => setUi({ settingsTab: t.id })}>
        <${Icon} name=${t.icon} size=${17} /><span>${t.label}</span>
      </button>`)}
    </nav>
    <div class="settings-body" key=${tab}>
      ${tab === 'appearance' && html`<${Appearance} s=${data.settings} />`}
      ${tab === 'types' && html`<${ActionTypes} data=${data} />`}
      ${tab === 'notes' && html`<${NoteFormat} data=${data} />`}
      ${tab === 'calendar' && html`<${CalendarSettings} s=${data.settings} />`}
      ${tab === 'profile' && html`<${ProfileSettings} profile=${profile} />`}
      ${tab === 'data' && html`<${DataSettings} data=${data} profile=${profile} />`}
      ${tab === 'updates' && html`<${UpdateLog} />`}
      ${tab === 'about' && html`<${About} />`}
    </div>
  </div>`;
}

function Section({ title, desc, children, actions }) {
  return html`<section class="card set-section">
    <header class="set-head"><div><h3>${title}</h3>${desc && html`<p>${desc}</p>`}</div>${actions}</header>
    <div class="set-content">${children}</div>
  </section>`;
}

function Row({ label, hint, children }) {
  return html`<div class="set-row"><div class="set-row-text"><span class="set-label">${label}</span>${hint && html`<span class="set-hint">${hint}</span>`}</div><div class="set-control">${children}</div></div>`;
}

// ------------------------------------------------------------------ appearance

function ThemeCard({ value, current, label, icon, onPick }) {
  return html`<button type="button" class=${cx('theme-card', value === current && 'is-active')} onClick=${() => onPick(value)}>
    <div class=${cx('theme-preview', `tp-${value}`)}>
      <div class="tp-side"><span></span><span></span><span></span></div>
      <div class="tp-main"><div class="tp-bar"></div><div class="tp-block"></div><div class="tp-block short"></div></div>
    </div>
    <span class="theme-label"><${Icon} name=${icon} size=${15} /> ${label}</span>
  </button>`;
}

const sameColor = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();

function BrandPalettes({ s }) {
  return html`<${Section} title="Brand palettes" desc="Match Trimble or B2W in one click, or pick a single brand color to use as your accent.">
    <div class="brand-grid">
      ${BRAND_PALETTES.map((p) => {
        const applied = sameColor(s.accent, p.apply.accent) && sameColor(s.accent2, p.apply.accent2) && s.darkStyle === p.apply.darkStyle;
        return html`<div class=${cx('brand-card', applied && 'is-active')}>
          <div class="brand-strip">
            ${p.colors.map((c) => html`<span style=${{ background: c.value }} data-tip=${`${c.name} · ${c.value}`}></span>`)}
          </div>
          <div class="brand-body">
            <div class="brand-head">
              <div><b>${p.name}</b><span class="muted">${p.desc}</span></div>
              <${Button} size="sm" variant=${applied ? 'accent-soft' : 'secondary'} icon=${applied ? 'check' : 'wand-sparkles'}
                onClick=${() => setSettings(p.apply)}>${applied ? 'Applied' : 'Apply'}<//>
            </div>
            <div class="brand-swatches">
              ${p.swatches.map((sw) => html`<button type="button" class=${cx('accent-opt', sameColor(sw.accent, s.accent) && 'is-active')}
                  style=${{ '--sw': sw.accent, '--sw2': sw.accent2 }} onClick=${() => setSettings({ accent: sw.accent, accent2: sw.accent2 })}>
                <span class="accent-dot"><${Icon} name="check" size=${14} stroke=${3} /></span><span>${sw.name}</span>
              </button>`)}
            </div>
          </div>
        </div>`;
      })}
    </div>
  <//>`;
}

function Appearance({ s }) {
  const known = [...ACCENTS.map((a) => a.value), ...BRAND_PALETTES.flatMap((p) => p.swatches.map((sw) => sw.accent))];
  const isPreset = known.some((v) => sameColor(v, s.accent));
  return html`
    <${Section} title="Theme" desc="Light, dark, or follow Windows.">
      <div class="theme-cards">
        <${ThemeCard} value="light" label="Light" icon="sun" current=${s.theme} onPick=${(v) => setSettings({ theme: v })} />
        <${ThemeCard} value="dark" label="Dark" icon="moon" current=${s.theme} onPick=${(v) => setSettings({ theme: v })} />
        <${ThemeCard} value="system" label="System" icon="monitor" current=${s.theme} onPick=${(v) => setSettings({ theme: v })} />
      </div>
    <//>
    <${BrandPalettes} s=${s} />
    <${Section} title="Accent color" desc="Used for buttons, highlights, the now-line and the logo.">
      <div class="accent-grid">
        ${ACCENTS.map((a) => html`<button type="button" class=${cx('accent-opt', sameColor(a.value, s.accent) && 'is-active')} style=${{ '--sw': a.value }} onClick=${() => setSettings({ accent: a.value, accent2: null })}>
          <span class="accent-dot"><${Icon} name="check" size=${14} stroke=${3} /></span><span>${a.name}</span>
        </button>`)}
        <label class=${cx('accent-opt accent-custom', !isPreset && 'is-active')} style=${{ '--sw': s.accent }}>
          <span class="accent-dot"><${Icon} name=${isPreset ? 'plus' : 'check'} size=${14} stroke=${3} /></span><span>Custom</span>
          <input type="color" value=${s.accent} onInput=${(e) => setSettings({ accent: e.currentTarget.value, accent2: null })} />
        </label>
      </div>
      <div class="brand-preview">
        <${LogoMark} size=${44} />
        <${Wordmark} size=${22} />
        <div class="toolbar-spacer"></div>
        <button type="button" class="btn btn-primary"><${Icon} name="plus" size=${17} /><span>Log Action</span></button>
        <${Button} variant="accent-soft" icon="sparkles">Generate notes<//>
      </div>
    <//>
    <${Section} title="Look & feel">
      <${Row} label="Dark mode style" hint="The surface colors used when FieldLogger is dark.">
        <${Segmented} value=${s.darkStyle || 'midnight'} onChange=${(v) => setSettings({ darkStyle: v })} options=${[{ value: 'midnight', label: 'Midnight' }, { value: 'trimble', label: 'Trimble Gray' }]} />
      <//>
      <${Row} label="Aurora glow" hint="Soft accent-colored light behind the app.">
        <${Switch} checked=${s.aurora} onChange=${(v) => setSettings({ aurora: v })} />
      <//>
      <${Row} label="Color events by" hint="How blocks are tinted on the calendar.">
        <${Segmented} value=${s.colorBy} onChange=${(v) => setSettings({ colorBy: v })} options=${[{ value: 'type', label: 'Action type' }, { value: 'client', label: 'Client' }]} />
      <//>
      <${Row} label="Calendar density" hint="Height of each hour on the day and week views.">
        <${Segmented} value=${s.density} onChange=${(v) => setSettings({ density: v })} options=${[{ value: 'compact', label: 'Compact' }, { value: 'comfortable', label: 'Comfortable' }, { value: 'spacious', label: 'Spacious' }]} />
      <//>
      ${isElectron && html`<${Row} label="Interface scale" hint="Make everything larger or smaller.">
        <${Segmented} value=${String(s.zoom || 1)} onChange=${(v) => setSettings({ zoom: Number(v) })} options=${[{ value: '0.9', label: '90%' }, { value: '1', label: '100%' }, { value: '1.1', label: '110%' }, { value: '1.25', label: '125%' }]} />
      <//>`}
    <//>
  `;
}

// ---------------------------------------------------------------- action types

function ActionTypes({ data }) {
  const [editing, setEditing] = useState(null);
  const usage = useMemo(() => {
    const m = {};
    for (const e of data.entries) m[e.typeId] = (m[e.typeId] || 0) + 1;
    return m;
  }, [data.entries]);

  const remove = async (t) => {
    if (usage[t.id]) {
      const ok = await confirmDialog({
        title: `Hide “${t.name}”?`,
        message: `It's used by ${usage[t.id]} logged ${usage[t.id] === 1 ? 'entry' : 'entries'}, so it'll be hidden from Log Action instead of deleted. Past entries keep their label.`,
        confirmLabel: 'Hide it',
      });
      if (ok) saveActionType({ ...t, archived: true });
      return;
    }
    const ok = await confirmDialog({ title: `Delete “${t.name}”?`, message: 'It has never been used, so it can be removed completely.', confirmLabel: 'Delete', danger: true });
    if (ok) deleteActionType(t.id);
  };

  return html`
    <${Section} title="Action types" desc="The buttons you pick from when logging. Rename them, recolor them, set a typical duration, or add your own."
      actions=${html`<div class="row-gap">
        <${Button} size="sm" variant="ghost" icon="rotate-ccw" onClick=${() => { restoreDefaultActionTypes(); toast('Default action types restored', { icon: 'rotate-ccw' }); }}>Restore defaults<//>
        <${Button} size="sm" variant="primary" icon="plus" onClick=${() => setEditing({})}>Add type<//>
      </div>`}>
      <div class="type-list">
        ${data.actionTypes.map((t, i) => html`<div class=${cx('type-row', t.archived && 'is-archived')}>
          <div class="type-move">
            <${IconButton} icon="chevron-up" label="Move up" size=${14} disabled=${i === 0} onClick=${() => moveActionType(t.id, -1)} />
            <${IconButton} icon="chevron-down" label="Move down" size=${14} disabled=${i === data.actionTypes.length - 1} onClick=${() => moveActionType(t.id, 1)} />
          </div>
          <${TypeBadge} type=${t} size=${34} />
          <div class="type-row-text">
            <span class="type-row-name">${t.name} ${t.archived && html`<span class="badge badge-muted">Hidden</span>`}</span>
            <span class="muted">${t.minutes ? `Typically ${t.minutes} min` : 'No default time'} · used ${usage[t.id] || 0}×</span>
          </div>
          ${t.archived
            ? html`<${Button} size="sm" icon="eye" onClick=${() => saveActionType({ ...t, archived: false })}>Show<//>`
            : html`<${IconButton} icon="eye-off" label="Hide from Log Action" onClick=${() => saveActionType({ ...t, archived: true })} />`}
          <${IconButton} icon="pencil" label="Edit" onClick=${() => setEditing(t)} />
          <${IconButton} icon="trash-2" label="Delete" onClick=${() => remove(t)} />
        </div>`)}
      </div>
    <//>
    ${editing && html`<${TypeEditor} type=${editing.id ? editing : null} count=${data.actionTypes.length} onClose=${() => setEditing(null)} />`}
  `;
}

function TypeEditor({ type, count, onClose }) {
  const [f, setF] = useState(() => ({ id: type?.id || uid('a'), name: type?.name || '', icon: type?.icon || 'sparkles', color: type?.color || PALETTE[count % PALETTE.length], minutes: type?.minutes ?? 30, archived: type?.archived || false }));
  const [error, setError] = useState('');
  const save = () => {
    if (!f.name.trim()) return setError('Give it a name.');
    saveActionType({ ...f, name: f.name.trim(), minutes: Math.max(0, Number(f.minutes) || 0) });
    toast(type ? 'Action type saved' : `Added “${f.name.trim()}”`, { icon: 'circle-check' });
    onClose();
  };
  return html`<${Modal} title=${type ? 'Edit action type' : 'New action type'} icon="layout-grid" onClose=${onClose} width=${600}
    footer=${html`<${Button} variant="ghost" onClick=${onClose}>Cancel<//><${Button} variant="primary" icon="check" onClick=${save}>Save<//>`}>
    <div class="form-stack">
      <div class="form-hero">
        <${TypeBadge} type=${f} size=${52} />
        <${Field} label="Name" error=${error} class="grow"><input class="input input-lg" value=${f.name} onInput=${(e) => { setF({ ...f, name: e.currentTarget.value }); setError(''); }} placeholder="e.g. Report Review" autofocus /><//>
      </div>
      <${Field} label="Typical duration (minutes)" hint="Pre-fills 'time spent' when you log this action. Use 0 for none.">
        <input class="input" type="number" min="0" max="720" step="5" value=${f.minutes} onInput=${(e) => setF({ ...f, minutes: e.currentTarget.value })} style=${{ maxWidth: '160px' }} />
      <//>
      <${Field} label="Color" group><${ColorPicker} value=${f.color} onChange=${(v) => setF({ ...f, color: v })} /><//>
      <${Field} label="Icon" group>
        <div class="icon-grid">
          ${ACTION_ICONS.map((name) => html`<button type="button" class=${cx('icon-opt', f.icon === name && 'is-active')} style=${{ '--tc': f.color }} onClick=${() => setF({ ...f, icon: name })} aria-label=${name}>
            <${Icon} name=${name} size=${18} />
          </button>`)}
        </div>
      <//>
    </div>
  <//>`;
}

// ---------------------------------------------------------------- note format

function NoteFormat({ data }) {
  const s = data.settings;
  const [tpl, setTpl] = useState(s.template);
  useEffect(() => setTpl(s.template), [s.template]);
  const commit = (v) => setSettings({ template: v || DEFAULT_TEMPLATE });

  const sample = useMemo(() => {
    const st = new Date();
    st.setHours(14, 0, 0, 0);
    const en = new Date(st.getTime() + 75 * 60000);
    const type = data.actionTypes.find((t) => t.id === 'template') || data.actionTypes[0];
    const client = data.clients[0] || { name: 'Granite Ridge Paving', kantataProject: 'GRP - Estimate Implementation', customerCode: 'GRPV' };
    return [
      { label: 'Time range', entry: { start: st.toISOString(), end: en.toISOString(), notes: 'Walked estimators through bid templates' }, type, client },
      { label: 'Timestamp, no notes', entry: { start: new Date(st.getTime() + 2 * 3600000 + 15 * 60000).toISOString(), end: null, minutes: 15, notes: '' }, type: data.actionTypes.find((t) => t.id === 'email') || type, client },
    ];
  }, [data.actionTypes, data.clients]);

  const insert = (token) => {
    const next = `${tpl}${tpl && !tpl.endsWith(' ') ? ' ' : ''}${token}`;
    setTpl(next);
    commit(next);
  };

  return html`
    <${Section} title="Line format" desc="How each entry is written on the Kantata Notes page. Click a token to add it.">
      <div class="tpl-input">
        <input class="input input-mono" value=${tpl} onInput=${(e) => setTpl(e.currentTarget.value)} onBlur=${() => commit(tpl)}
          onKeyDown=${(e) => e.key === 'Enter' && commit(tpl)} spellcheck=${false} />
        <${Button} variant="ghost" icon="rotate-ccw" onClick=${() => { setTpl(DEFAULT_TEMPLATE); commit(DEFAULT_TEMPLATE); }}>Reset<//>
      </div>
      <div class="token-row">
        ${NOTE_TOKENS.map((t) => html`<button type="button" class="token" onClick=${() => insert(t.token)} data-tip=${t.hint}><code>${t.token}</code> ${t.label}</button>`)}
      </div>
      <div class="tpl-preview">
        ${sample.map((x) => html`<div class="tpl-sample">
          <span class="eyebrow">${x.label}</span>
          <div class="kp-line">${renderLine(x.entry, { type: x.type, client: x.client, settings: { ...s, template: tpl } })}</div>
        </div>`)}
      </div>
      <p class="set-hint">Empty pieces are tidied up automatically, so an entry with no notes reads <code>4:15 PM: Email</code> rather than ending in a dangling dash.</p>
    <//>
    <${Section} title="Hours" desc="How time adds up on the Kantata Notes page.">
      <${Row} label="Round hours to" hint="Applied per project per day, the way Kantata time entries work.">
        <${Segmented} value=${String(s.roundTo)} onChange=${(v) => setSettings({ roundTo: Number(v) })} options=${[{ value: '0', label: 'Exact' }, { value: '0.1', label: '0.1h' }, { value: '0.25', label: '¼h' }, { value: '0.5', label: '½h' }]} />
      <//>
      <${Row} label="Rounding" hint="Nearest is standard. Up never under-reports.">
        <${Segmented} value=${s.roundMode} onChange=${(v) => setSettings({ roundMode: v })} options=${[{ value: 'nearest', label: 'Nearest' }, { value: 'up', label: 'Always up' }]} />
      <//>
      <${Row} label="Daily target" hint="Fills the ring in the sidebar.">
        <div class="num-input"><input class="input" type="number" min="1" max="16" step="0.5" value=${s.dailyTarget} onInput=${(e) => setSettings({ dailyTarget: Math.max(1, Number(e.currentTarget.value) || 8) })} /><span>hours</span></div>
      <//>
      <${Row} label="Check off on copy" hint="Copying a line on Kantata Notes marks it entered.">
        <${Switch} checked=${s.autoMarkOnCopy} onChange=${(v) => setSettings({ autoMarkOnCopy: v })} />
      <//>
    <//>
  `;
}

// -------------------------------------------------------------------- calendar

function CalendarSettings({ s }) {
  const hours = Array.from({ length: 25 }, (_, h) => h);
  return html`<${Section} title="Calendar" desc="Your working hours and how weeks are laid out.">
    <${Row} label="Workday starts" hint="The grid grows automatically if you log outside these hours.">
      <select class="input select-sm" value=${s.dayStart} onChange=${(e) => setSettings({ dayStart: Math.min(Number(e.currentTarget.value), s.dayEnd - 1) })}>
        ${hours.slice(0, 24).map((h) => html`<option value=${h}>${fmtHourLabel(h, s.hour12)}</option>`)}
      </select>
    <//>
    <${Row} label="Workday ends">
      <select class="input select-sm" value=${s.dayEnd} onChange=${(e) => setSettings({ dayEnd: Math.max(Number(e.currentTarget.value), s.dayStart + 1) })}>
        ${hours.slice(1).map((h) => html`<option value=${h}>${h === 24 ? 'Midnight' : fmtHourLabel(h, s.hour12)}</option>`)}
      </select>
    <//>
    <${Row} label="Week starts on">
      <${Segmented} value=${String(s.weekStart)} onChange=${(v) => setSettings({ weekStart: Number(v) })} options=${[{ value: '0', label: 'Sunday' }, { value: '1', label: 'Monday' }]} />
    <//>
    <${Row} label="Show weekends in week view">
      <${Switch} checked=${s.showWeekends} onChange=${(v) => setSettings({ showWeekends: v })} />
    <//>
    <${Row} label="Time format">
      <${Segmented} value=${s.hour12 ? '12' : '24'} onChange=${(v) => setSettings({ hour12: v === '12' })} options=${[{ value: '12', label: '2:30 PM' }, { value: '24', label: '14:30' }]} />
    <//>
    <${Row} label="Open calendar in" hint="The view you land on when FieldLogger starts.">
      <${Segmented} value=${s.defaultView} onChange=${(v) => setSettings({ defaultView: v })} options=${[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />
    <//>
  <//>`;
}

// --------------------------------------------------------------------- profile

function ProfileSettings({ profile }) {
  const [name, setName] = useState(profile.name);
  const [role, setRole] = useState(profile.role || '');
  const [pinOpen, setPinOpen] = useState(false);
  const save = async () => {
    if (!name.trim()) return;
    await updateProfile({ name: name.trim(), role: role.trim() });
    toast('Profile updated', { icon: 'user-round' });
  };
  const removePin = async () => {
    const ok = await confirmDialog({ title: 'Remove PIN?', message: 'Anyone using this computer will be able to open your profile.', confirmLabel: 'Remove PIN' });
    if (!ok) return;
    await setProfilePin(null);
    toast('PIN removed', { icon: 'lock-open' });
  };
  const pickPhoto = async (file) => {
    try {
      await updateProfile({ photo: await processPhoto(file) });
      toast('Profile picture updated', { icon: 'camera' });
    } catch (err) {
      toast(err.message || String(err), { tone: 'error' });
    }
  };
  usePasteImage(pickPhoto);

  return html`
    <${Section} title="Your profile" desc="Profiles are local to this computer. No email or password needed.">
      <div class="profile-edit">
        <div class="photo-col">
          <${ImageDrop} round onFile=${pickPhoto} tip="Change profile picture (click, drop or paste)">
            <${Avatar} name=${name || '?'} color=${profile.color} src=${profile.photo} size=${80} />
          <//>
          ${profile.photo
            ? html`<button type="button" class="link small" onClick=${() => updateProfile({ photo: null })}>Remove photo</button>`
            : html`<span class="photo-hint">Add a photo</span>`}
        </div>
        <div class="form-grid grow">
          <${Field} label="Name"><input class="input" value=${name} onInput=${(e) => setName(e.currentTarget.value)} onBlur=${save} maxlength="60" /><//>
          <${Field} label="Role"><input class="input" value=${role} onInput=${(e) => setRole(e.currentTarget.value)} onBlur=${save} placeholder="Implementation Consultant" maxlength="80" /><//>
        </div>
      </div>
      <${Field} label="Avatar color" group><${ColorPicker} value=${profile.color} onChange=${(c) => updateProfile({ color: c })} /><//>
    <//>
    <${Section} title="PIN lock" desc="A PIN keeps casual eyes out on a shared computer. It's a lock screen, not encryption.">
      <div class="pin-status">
        <div class=${cx('pin-icon', profile.hasPin && 'is-on')}><${Icon} name=${profile.hasPin ? 'lock' : 'lock-open'} size=${20} /></div>
        <div class="grow"><b>${profile.hasPin ? 'PIN is on' : 'No PIN'}</b><div class="muted">${profile.hasPin ? 'You will be asked for it each time FieldLogger opens.' : 'FieldLogger opens straight to your calendar.'}</div></div>
        <${Button} icon=${profile.hasPin ? 'refresh-cw' : 'lock'} onClick=${() => setPinOpen(true)}>${profile.hasPin ? 'Change PIN' : 'Set a PIN'}<//>
        ${profile.hasPin && html`<${Button} variant="ghost" onClick=${removePin}>Remove<//>`}
      </div>
      ${profile.hasPin && html`<${Switch} checked=${profile.pinOnLaunch} onChange=${(v) => updateProfile({ pinOnLaunch: v })}
        label="Ask for PIN when FieldLogger opens"
        hint=${profile.pinOnLaunch ? 'Closing the app locks it. You will enter your PIN next time.' : 'You stay signed in between launches. Use Lock to require the PIN.'} />`}
    <//>
    <${Section} title="Lock or switch profile" desc="FieldLogger keeps you signed in when you close it. Lock or switch here.">
      <div class="row-gap">
        ${profile.hasPin && html`<${Button} icon="lock" onClick=${lock}>Lock now<//>`}
        <${Button} icon="log-out" onClick=${signOut}>Switch profile<//>
      </div>
    <//>
    ${pinOpen && html`<${PinDialog} onClose=${() => setPinOpen(false)} />`}
  `;
}

function PinDialog({ onClose }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [error, setError] = useState('');
  const save = async () => {
    if (!/^\d{4,8}$/.test(a)) return setError('Use 4 to 8 digits.');
    if (a !== b) return setError("PINs don't match.");
    await setProfilePin(a);
    toast('PIN saved', { icon: 'lock' });
    onClose();
  };
  const digits = (fn) => (e) => { fn(e.currentTarget.value.replace(/\D/g, '')); setError(''); };
  return html`<${Modal} title="Set PIN" icon="lock" onClose=${onClose} width=${420}
    footer=${html`<${Button} variant="ghost" onClick=${onClose}>Cancel<//><${Button} variant="primary" icon="check" onClick=${save}>Save PIN<//>`}>
    <div class="form-stack" onKeyDown=${(e) => e.key === 'Enter' && save()}>
      <${Field} label="New PIN"><input class="input input-pin" type="password" inputmode="numeric" maxlength="8" value=${a} onInput=${digits(setA)} autofocus /><//>
      <${Field} label="Confirm PIN" error=${error}><input class="input input-pin" type="password" inputmode="numeric" maxlength="8" value=${b} onInput=${digits(setB)} /><//>
    </div>
  <//>`;
}

// ------------------------------------------------------------------------ data

function DataSettings({ data, profile }) {
  const [info, setInfo] = useState(null);
  useEffect(() => { bridge.app.info().then(setInfo); }, []);
  const demoCount = data.entries.filter((e) => e.demo).length + data.clients.filter((c) => c.demo).length;

  const exportBackup = async () => {
    await flush();
    const stamp = new Date().toISOString().slice(0, 10);
    const saved = await bridge.data.exportFile({ ...data, exportedAt: new Date().toISOString(), exportedBy: profile.name, app: APP_NAME }, `FieldLogger-${profile.name.replace(/\s+/g, '-')}-${stamp}.json`);
    if (saved) toast('Backup exported', { icon: 'download' });
  };

  const importBackup = async () => {
    let raw;
    try {
      raw = await bridge.data.importFile();
    } catch {
      return toast("That file isn't a FieldLogger backup.", { tone: 'error' });
    }
    if (!raw) return;
    if (!Array.isArray(raw.entries) || !Array.isArray(raw.clients)) return toast("That file isn't a FieldLogger backup.", { tone: 'error' });
    if (isNewerData(raw)) return toast('That backup was made by a newer version of FieldLogger. Install the latest version, then import it.', { tone: 'error' });
    const ok = await confirmDialog({
      title: 'Replace your data with this backup?',
      message: `The backup has ${raw.clients.length} clients and ${raw.entries.length} entries. Your current ${data.clients.length} clients and ${data.entries.length} entries will be replaced. Your current data is kept as a backup, so you can restore it below.`,
      confirmLabel: 'Replace data',
      danger: true,
    });
    if (!ok) return;
    replaceData(raw);
    toast('Backup imported', { icon: 'upload' });
  };

  const restoreBackup = async (b) => {
    const ok = await confirmDialog({
      title: 'Restore this backup?',
      message: `Your data goes back to the ${b.label.toLowerCase()} copy from ${fmtDateLong(b.at)}: ${b.clients} clients and ${b.entries} entries. You have ${data.clients.length} clients and ${data.entries.length} entries now. Your current data is kept as a copy first, so you can switch back.`,
      confirmLabel: 'Restore',
      icon: 'rotate-ccw',
    });
    if (!ok) return;
    try {
      await flush();
      await bridge.backups.restore(profile.id, b.key);
      await reloadData();
      toast('Backup restored', { icon: 'rotate-ccw' });
    } catch (err) {
      toast(`Couldn't restore: ${err.message || err}`, { tone: 'error' });
    }
  };

  const deleteProfile = async () => {
    const ok = await confirmDialog({
      title: `Delete ${profile.name}'s profile?`,
      message: 'Your clients and logs are moved to the backups folder (not erased), and the profile disappears from the launch screen.',
      confirmLabel: 'Delete profile',
      danger: true,
    });
    if (!ok) return;
    await flush();
    await bridge.profiles.remove(profile.id);
    await signOut();
  };

  return html`
    <${Section} title="Where your data lives" desc="FieldLogger is fully offline. Nothing leaves this computer.">
      <div class="data-path">
        <${Icon} name="folder-open" size=${18} />
        <code>${info?.dataDir || '…'}</code>
        ${isElectron && html`<${Button} size="sm" onClick=${() => bridge.app.openDataFolder()}>Open folder<//>`}
      </div>
      <p class="set-hint">FieldLogger saves as you work. In the <code>backups</code> folder it keeps a copy from each of the last 14 days, the version before your last save, and a full copy taken before every update. Updating or uninstalling never touches this folder.</p>
    <//>
    <${Section} title="Restore a backup" desc="Put your data back the way it was. Your current data is kept as a copy first.">
      ${isElectron
        ? html`<${BackupList} profileId=${profile.id} onRestore=${restoreBackup} />`
        : html`<p class="set-hint">Backups are kept by the desktop app.</p>`}
    <//>
    <${Section} title="Export & import" desc="Move to a new computer, or keep your own copy.">
      <div class="row-gap">
        <${Button} icon="download" onClick=${exportBackup}>Export backup (.json)<//>
        <${Button} icon="upload" onClick=${importBackup}>Import backup<//>
      </div>
    <//>
    <${Section} title="Sample data" desc="Example clients and two weeks of logs, handy for a demo or for trying features.">
      <div class="row-gap">
        <${Button} icon="sparkles" onClick=${() => { loadDemo(); toast('Sample data loaded', { icon: 'sparkles' }); }}>${demoCount ? 'Reload sample data' : 'Load sample data'}<//>
        ${demoCount > 0 && html`<${Button} variant="ghost-danger" icon="trash-2" onClick=${() => { removeDemo(); toast('Sample data removed', { icon: 'trash-2' }); }}>Remove sample data (${demoCount})<//>`}
      </div>
    <//>
    <${Section} title="Danger zone">
      <div class="danger-row">
        <div><b>Delete this profile</b><div class="muted">Removes it from this computer. Data is moved to backups.</div></div>
        <${Button} variant="danger" icon="trash-2" onClick=${deleteProfile}>Delete profile<//>
      </div>
    <//>
  `;
}

// ------------------------------------------------------------------ update log

// The packaged app reports package.json's version; the browser preview has none, so use the newest log entry.
function useAppVersion() {
  const [info, setInfo] = useState(null);
  useEffect(() => { bridge.app.info().then(setInfo); }, []);
  return !info?.version || info.version === 'preview' ? LATEST_VERSION : info.version;
}

const KIND = {
  new: { label: 'New', cls: 'badge-accent' },
  improved: { label: 'Improved', cls: 'badge-muted' },
  fixed: { label: 'Fixed', cls: 'badge-ok' },
};

function UpdateLog() {
  const version = useAppVersion();
  return html`
    <${Section} title="Update log" desc=${`You're on version ${version}. Here's what changed in each release.`}>
      <div class="changelog">
        ${CHANGELOG.map((r) => html`<article class=${cx('release', r.version === version && 'is-current')}>
          <header class="release-head">
            <span class="release-version">v${r.version}</span>
            ${r.version === version && html`<span class="badge badge-live">Installed</span>`}
            <span class="release-title">${r.title}</span>
            <span class="release-date muted">${fmtDateLong(parseKey(r.date))}</span>
          </header>
          <ul class="release-items">
            ${r.items.map((it) => html`<li><span class=${cx('badge', KIND[it.kind]?.cls)}>${KIND[it.kind]?.label || it.kind}</span><span>${it.text}</span></li>`)}
          </ul>
        </article>`)}
      </div>
    <//>
  `;
}

// ----------------------------------------------------------------------- about

function About() {
  const version = useAppVersion();
  const keys = [
    [['Ctrl', 'L'], 'Log Action'],
    [['Ctrl', 'Enter'], 'Save in a dialog'],
    [['Esc'], 'Close dialog'],
    [['Ctrl', '1-4'], 'Calendar · Clients · Notes · Settings'],
    [['T'], 'Jump to today'],
    [['←', '→'], 'Previous / next day, week or month'],
    [['D', 'W', 'M'], 'Day, week, month view'],
    [['Drag'], 'Click and drag on the calendar to log a time range'],
  ];
  return html`
    <${Section} title="Keyboard shortcuts">
      <div class="shortcut-list">
        ${keys.map(([k, label]) => html`<div class="shortcut"><span>${label}</span><span class="keys">${k.map((x) => html`<${Kbd}>${x}<//>`)}</span></div>`)}
      </div>
    <//>
    <${Section} title=${`About ${APP_NAME}`}>
      <div class="about">
        <${LogoMark} size=${64} />
        <div>
          <${Wordmark} size=${26} />
          <p class="muted">Version ${version} · Built for implementation consultants who live in Kantata.</p>
          <button type="button" class="link-btn" onClick=${() => setUi({ settingsTab: 'updates' })}><${Icon} name="history" size=${14} /> See what's new</button>
        </div>
      </div>
    <//>
  `;
}
