// Clients & projects: list, detail page, client form and contact form.
import { html, useEffect, useMemo, useRef, useState } from '../lib/h.js';
import {
  useSession, useUi, setUi, addClient, updateClient, deleteClient, saveContact, deleteContact, openLog, openEdit, confirmDialog, toast, copyText,
} from '../lib/store.js';
import { ERP_LOGOS, ERP_SYSTEMS, PALETTE, PHASES } from '../lib/defaults.js';
import { dateKey, todayKey, parseKey, addDays, startOfWeek, fmtHours, fmtDateLong, fmtDateShort, relativeTime } from '../lib/time.js';
import { entryMinutes, entryTimeText, renderLine, totalMinutes } from '../lib/notes.js';
import { processLogo, chooseImage } from '../lib/image.js';
import {
  Avatar, Button, ClientAvatar, ColorPicker, CopyButton, EmptyState, ErpLogo, Field, Icon, IconButton, ImageDrop, Menu, Modal, Segmented, Switch, TypeBadge, cx, usePasteImage,
} from './ui.js';

export function ClientsView() {
  const u = useUi();
  const { data } = useSession();
  const client = u.clientId && data.clients.find((c) => c.id === u.clientId);
  if (client) return html`<${ClientDetail} client=${client} data=${data} />`;
  return html`<${ClientList} data=${data} />`;
}

function useClientStats(data) {
  return useMemo(() => {
    const weekStart = startOfWeek(new Date(), data.settings.weekStart).getTime();
    const spark0 = addDays(parseKey(todayKey()), -13).getTime();
    const stats = {};
    for (const c of data.clients) stats[c.id] = { week: 0, total: 0, last: null, count: 0, spark: new Array(14).fill(0) };
    for (const e of data.entries) {
      const st = stats[e.clientId];
      if (!st) continue;
      const t = new Date(e.start).getTime();
      const m = entryMinutes(e);
      st.total += m;
      st.count += 1;
      if (t >= weekStart) st.week += m;
      if (!st.last || t > st.last) st.last = t;
      const idx = Math.floor((parseKey(dateKey(new Date(t))).getTime() - spark0) / 86400000);
      if (idx >= 0 && idx < 14) st.spark[idx] += m || 10;
    }
    return stats;
  }, [data.entries, data.clients, data.settings.weekStart]);
}

function ClientList({ data }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('active');
  const [sort, setSort] = useState('recent');
  const [editing, setEditing] = useState(null);
  const stats = useClientStats(data);

  const counts = { active: data.clients.filter((c) => c.active).length, inactive: data.clients.filter((c) => !c.active).length };
  const list = data.clients
    .filter((c) => (filter === 'all' ? true : filter === 'active' ? c.active : !c.active))
    .filter((c) => {
      const ql = q.trim().toLowerCase();
      if (!ql) return true;
      return [c.name, c.kantataProject, c.location, c.erp, ...(c.contacts || []).map((k) => `${k.name} ${k.email}`)].join(' ').toLowerCase().includes(ql);
    })
    .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : (stats[b.id]?.last || 0) - (stats[a.id]?.last || 0) || a.name.localeCompare(b.name)));

  return html`<div class="clients">
    <div class="toolbar">
      <div class="search">
        <${Icon} name="search" size=${16} />
        <input value=${q} onInput=${(e) => setQ(e.currentTarget.value)} placeholder="Search clients, projects, contacts…" />
        ${q && html`<button type="button" class="search-x" onClick=${() => setQ('')}><${Icon} name="x" size=${14} /></button>`}
      </div>
      <${Segmented} value=${filter} onChange=${setFilter} options=${[
        { value: 'active', label: `Active ${counts.active}` },
        { value: 'inactive', label: `Inactive ${counts.inactive}` },
        { value: 'all', label: 'All' },
      ]} />
      <${Segmented} value=${sort} onChange=${setSort} options=${[
        { value: 'recent', icon: 'history', tip: 'Sort by recent activity' },
        { value: 'name', icon: 'type', tip: 'Sort by name' },
      ]} />
      <div class="toolbar-spacer"></div>
      <${Button} variant="primary" icon="plus" onClick=${() => setEditing({})}>New client<//>
    </div>

    ${list.length === 0
      ? html`<div class="card"><${EmptyState} icon="building-2" title=${data.clients.length ? 'No clients match' : 'Add your first client'}
          action=${!data.clients.length && html`<${Button} variant="primary" icon="plus" onClick=${() => setEditing({})}>New client<//>`}>
          ${data.clients.length ? 'Try a different search or filter.' : 'Clients hold your projects, contacts, POCs and notes. Every log ties back to one.'}
        <//></div>`
      : html`<div class="client-grid">
          ${list.map((c, i) => html`<${ClientCard} key=${c.id} client=${c} stats=${stats[c.id]} index=${i} />`)}
        </div>`}

    ${editing && html`<${ClientForm} client=${editing.id ? editing : null} onClose=${() => setEditing(null)} count=${data.clients.length} />`}
  </div>`;
}

function Sparkline({ values, color }) {
  const max = Math.max(...values, 1);
  return html`<div class="spark" style=${{ '--sc': color }}>
    ${values.map((v) => html`<span style=${{ height: `${Math.max(v ? 18 : 6, (v / max) * 100)}%`, opacity: v ? 1 : 0.35 }}></span>`)}
  </div>`;
}

function PhaseBar({ phase }) {
  const idx = Math.max(0, PHASES.indexOf(phase));
  return html`<div class="phase-bar" title=${phase}>
    ${PHASES.map((p, i) => html`<span class=${cx(i <= idx && 'is-done', i === idx && 'is-current')}></span>`)}
  </div>`;
}

function ClientCard({ client: c, stats, index }) {
  const poc = (c.contacts || []).find((k) => k.poc) || (c.contacts || [])[0];
  return html`<button type="button" class=${cx('client-card', !c.active && 'is-inactive')} style=${{ '--cc': c.color, animationDelay: `${Math.min(index, 12) * 25}ms` }}
      onClick=${() => setUi({ clientId: c.id })}>
    <div class="cc-top">
      <${ClientAvatar} client=${c} size=${44} />
      <div class="cc-titles">
        <span class="cc-name">${c.name}</span>
        <span class="cc-project">${c.kantataProject || 'No Kantata project set'}</span>
      </div>
      ${c.erp && html`<span class="cc-erp" data-tip=${c.erp}><${ErpLogo} erp=${c.erp} logos=${ERP_LOGOS} size=${28} /></span>`}
      ${!c.active && html`<span class="badge badge-muted">Inactive</span>`}
    </div>
    <div class="cc-phase">
      <span class="cc-phase-label">${c.phase || 'Kickoff'}</span>
      <${PhaseBar} phase=${c.phase} />
    </div>
    <div class="cc-poc">
      ${poc
        ? html`<${Icon} name="user-round" size=${14} /><span class="cc-poc-name">${poc.name}</span>${poc.role && html`<span class="muted">· ${poc.role}</span>`}`
        : html`<${Icon} name="user-plus" size=${14} /><span class="muted">No contacts yet</span>`}
    </div>
    <div class="cc-foot">
      <div class="cc-stats">
        <span><b>${fmtHours((stats?.week || 0) / 60)}h</b> this week</span>
        <span class="muted">${stats?.last ? `Last log ${relativeTime(stats.last)}` : 'No logs yet'}</span>
      </div>
      <${Sparkline} values=${stats?.spark || new Array(14).fill(0)} color=${c.color} />
    </div>
  </button>`;
}

function ClientDetail({ client: c, data }) {
  const [editing, setEditing] = useState(false);
  const [contact, setContact] = useState(null);
  const stats = useClientStats(data)[c.id];
  const s = data.settings;
  const typeById = useMemo(() => Object.fromEntries(data.actionTypes.map((t) => [t.id, t])), [data.actionTypes]);

  const entries = useMemo(() => data.entries.filter((e) => e.clientId === c.id).sort((a, b) => new Date(b.start) - new Date(a.start)), [data.entries, c.id]);
  const monthMinutes = useMemo(() => {
    const now = new Date();
    return totalMinutes(entries.filter((e) => { const d = new Date(e.start); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }));
  }, [entries]);
  const groups = useMemo(() => {
    const out = [];
    for (const e of entries.slice(0, 120)) {
      const k = dateKey(new Date(e.start));
      let g = out[out.length - 1];
      if (!g || g.key !== k) out.push((g = { key: k, items: [] }));
      g.items.push(e);
    }
    return out;
  }, [entries]);

  const remove = async () => {
    const ok = await confirmDialog({
      title: `Delete ${c.name}?`,
      message: entries.length
        ? `Its ${entries.length} logged ${entries.length === 1 ? 'entry stays' : 'entries stay'} on your calendar as Internal. If you just want it out of the way, mark it inactive instead.`
        : 'This removes the client and its contacts.',
      confirmLabel: 'Delete client',
      danger: true,
    });
    if (!ok) return;
    deleteClient(c.id);
    setUi({ clientId: null });
    toast(`Deleted ${c.name}`, { tone: 'info', icon: 'trash-2' });
  };

  const changeLogo = async (file) => {
    try {
      updateClient(c.id, await processLogo(file));
      toast(`Logo updated for ${c.name}`, { icon: 'image' });
    } catch (err) {
      toast(err.message || String(err), { tone: 'error' });
    }
  };

  const toggleActive = () => {
    updateClient(c.id, { active: !c.active });
    toast(c.active ? `${c.name} marked inactive` : `${c.name} is active again`, { icon: c.active ? 'archive' : 'archive-restore' });
  };

  return html`<div class="client-detail" style=${{ '--cc': c.color }}>
    <div class="detail-hero card">
      <div class="hero-glow"></div>
      <button type="button" class="back-link" onClick=${() => setUi({ clientId: null })}><${Icon} name="arrow-left" size=${15} /> All clients</button>
      <div class="hero-row">
        <${ImageDrop} onFile=${changeLogo} tip=${c.logo ? 'Change logo (click or drop an image)' : 'Add a logo (click or drop an image)'}>
          <${ClientAvatar} client=${c} size=${72} />
        <//>
        <div class="hero-titles">
          <div class="hero-name-row">
            <h2>${c.name}</h2>
            <span class=${cx('badge', c.active ? 'badge-live' : 'badge-muted')}>${c.active ? 'Active' : 'Inactive'}</span>
          </div>
          <div class="hero-meta">
            ${c.kantataProject && html`<span><${Icon} name="clipboard-list" size=${14} /> ${c.kantataProject}</span>`}
            ${c.location && html`<span><${Icon} name="map-pin" size=${14} /> ${c.location}</span>`}
            ${c.erp && html`<span data-tip="Accounting / ERP"><${ErpLogo} erp=${c.erp} logos=${ERP_LOGOS} size=${18} /> ${c.erp}</span>`}
            ${c.startDate && html`<span><${Icon} name="calendar" size=${14} /> Started ${fmtDateShort(parseKey(c.startDate))}</span>`}
            ${c.goLiveDate && html`<span><${Icon} name="rocket" size=${14} /> Go-live ${fmtDateShort(parseKey(c.goLiveDate))}</span>`}
            ${c.website && html`<a href=${c.website} target="_blank" rel="noreferrer"><${Icon} name="globe" size=${14} /> Website</a>`}
          </div>
        </div>
        <div class="hero-actions">
          ${c.engagementUrl
            ? html`<a class="btn btn-secondary" href=${c.engagementUrl} target="_blank" rel="noreferrer" data-tip=${c.engagementUrl}>
                <${Icon} name="external-link" size=${16} /><span>Open engagement</span></a>`
            : html`<${Button} variant="ghost" icon="link" onClick=${() => setEditing(true)} data-tip="Paste the Kantata / Salesforce DX engagement page">Add engagement link<//>`}
          <${Button} variant="primary" icon="plus" onClick=${() => openLog({ clientId: c.id })}>Log action<//>
          <${Button} icon="pencil" onClick=${() => setEditing(true)}>Edit<//>
          <${Menu} trigger=${({ toggle }) => html`<${IconButton} icon="ellipsis" label="More" onClick=${toggle} />`} items=${[
            { label: c.active ? 'Mark inactive' : 'Mark active', icon: c.active ? 'archive' : 'archive-restore', run: toggleActive },
            { label: 'Copy Kantata project name', icon: 'copy', run: () => copyText(c.kantataProject || c.name) },
            c.engagementUrl && { label: 'Copy engagement link', icon: 'link', run: () => copyText(c.engagementUrl, 'Engagement link copied') },
            c.logo && { label: 'Remove logo', icon: 'image', run: () => updateClient(c.id, { logo: null }) },
            '-',
            { label: 'Delete client', icon: 'trash-2', danger: true, run: remove },
          ]} />
        </div>
      </div>
      <${PhaseStepper} phase=${c.phase} onChange=${(p) => updateClient(c.id, { phase: p })} />
    </div>

    <div class="detail-grid">
      <div class="detail-main">
        <div class="stat-tiles">
          <div class="stat-tile"><span class="eyebrow">This week</span><b>${fmtHours((stats?.week || 0) / 60)}<small>h</small></b></div>
          <div class="stat-tile"><span class="eyebrow">This month</span><b>${fmtHours(monthMinutes / 60)}<small>h</small></b></div>
          <div class="stat-tile"><span class="eyebrow">All time</span><b>${fmtHours((stats?.total || 0) / 60)}<small>h</small></b></div>
          <div class="stat-tile"><span class="eyebrow">Entries</span><b>${entries.length}</b></div>
        </div>

        <div class="card">
          <div class="card-head"><h3><${Icon} name="history" size=${17} /> Activity</h3><span class="muted">${entries.length ? `Last ${relativeTime(entries[0].start)}` : ''}</span></div>
          ${groups.length === 0
            ? html`<${EmptyState} icon="calendar-plus" title="No activity yet" action=${html`<${Button} variant="accent-soft" icon="plus" onClick=${() => openLog({ clientId: c.id })}>Log the first action<//>`}>
                Everything you log for ${c.name} shows up here.
              <//>`
            : html`<div class="activity">
              ${groups.map((g) => html`<div class="act-day">
                <div class="act-day-head"><span>${fmtDateLong(parseKey(g.key))}</span><span class="muted">${fmtHours(totalMinutes(g.items) / 60)}h</span></div>
                ${g.items.map((e) => {
                  const t = typeById[e.typeId];
                  const line = renderLine(e, { type: t, client: c, settings: s });
                  return html`<div class="act-row" onClick=${() => openEdit(e.id)}>
                    <${TypeBadge} type=${t} size=${30} />
                    <div class="act-text">
                      <span class="act-title">${t?.name || 'Action'} <span class="muted">· ${entryTimeText(e, s.hour12)}</span></span>
                      ${e.notes && html`<span class="act-notes">${e.notes}</span>`}
                    </div>
                    ${e.entered && html`<span class="badge badge-ok"><${Icon} name="check" size=${11} stroke=${3} /> Kantata</span>`}
                    <span class="act-hours">${entryMinutes(e) ? `${fmtHours(entryMinutes(e) / 60)}h` : ''}</span>
                    <${CopyButton} compact text=${line} onCopy=${(x) => copyText(x)} label="Copy Kantata line" />
                  </div>`;
                })}
              </div>`)}
            </div>`}
        </div>
      </div>

      <div class="detail-side">
        <div class="card">
          <div class="card-head"><h3><${Icon} name="users" size=${17} /> Contacts</h3>
            <${Button} size="sm" variant="ghost" icon="plus" onClick=${() => setContact({})}>Add<//>
          </div>
          ${(c.contacts || []).length === 0
            ? html`<p class="card-empty">Add the client's POC and key people so their details are one click away.</p>`
            : html`<div class="contacts">
              ${c.contacts.slice().sort((a, b) => Number(b.poc) - Number(a.poc)).map((k) => html`<div class=${cx('contact', k.poc && 'is-poc')}>
                <${Avatar} name=${k.name} color=${c.color} size=${36} />
                <div class="contact-text">
                  <span class="contact-name">${k.name} ${k.poc && html`<span class="badge badge-accent"><${Icon} name="star" size=${10} /> POC</span>`}</span>
                  ${k.role && html`<span class="contact-role">${k.role}</span>`}
                  <div class="contact-links">
                    ${k.email && html`<a href=${`mailto:${k.email}`}><${Icon} name="mail" size=${13} />${k.email}</a>`}
                    ${k.phone && html`<a href=${`tel:${k.phone.replace(/[^\d+]/g, '')}`}><${Icon} name="phone" size=${13} />${k.phone}</a>`}
                  </div>
                  ${k.notes && html`<span class="contact-notes">${k.notes}</span>`}
                </div>
                <div class="contact-actions">
                  ${k.email && html`<${IconButton} icon="copy" label="Copy email" size=${15} onClick=${() => copyText(k.email, 'Email copied')} />`}
                  <${IconButton} icon="pencil" label="Edit contact" size=${15} onClick=${() => setContact(k)} />
                </div>
              </div>`)}
            </div>`}
        </div>

        <${ClientNotes} client=${c} />
      </div>
    </div>

    ${editing && html`<${ClientForm} client=${c} onClose=${() => setEditing(false)} />`}
    ${contact && html`<${ContactForm} client=${c} contact=${contact.id ? contact : null} onClose=${() => setContact(null)} />`}
  </div>`;
}

function PhaseStepper({ phase, onChange }) {
  const idx = Math.max(0, PHASES.indexOf(phase));
  return html`<div class="stepper">
    ${PHASES.map((p, i) => html`<button type="button" class=${cx('step', i < idx && 'is-done', i === idx && 'is-current')} onClick=${() => onChange(p)} data-tip=${`Set phase: ${p}`}>
      <span class="step-dot">${i < idx ? html`<${Icon} name="check" size=${12} stroke=${3} />` : i + 1}</span>
      <span class="step-label">${p}</span>
    </button>`)}
  </div>`;
}

// Free-form notes that save as you type.
function ClientNotes({ client }) {
  const [text, setText] = useState(client.notes || '');
  const [state, setState] = useState('saved');
  const timer = useRef(null);
  useEffect(() => { setText(client.notes || ''); }, [client.id]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const onInput = (e) => {
    const v = e.currentTarget.value;
    setText(v);
    setState('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      updateClient(client.id, { notes: v });
      setState('saved');
    }, 500);
  };
  return html`<div class="card notes-card">
    <div class="card-head"><h3><${Icon} name="notebook-pen" size=${17} /> Notes</h3>
      <span class=${cx('save-state', state === 'saving' && 'is-saving')}>${state === 'saving' ? 'Saving…' : html`<${Icon} name="check" size=${13} /> Saved`}</span>
    </div>
    <textarea class="input textarea notes-area" value=${text} onInput=${onInput}
      placeholder="Scope, decisions, quirks, login details to remember (no passwords), next steps…"></textarea>
  </div>`;
}

// '' stays empty, bare domains get https://, anything that isn't a web link is null.
function normalizeUrl(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.href : null;
  } catch {
    return null;
  }
}

export function ClientForm({ client, onClose, count = 0 }) {
  const [f, setF] = useState(() => ({
    name: client?.name || '',
    kantataProject: client?.kantataProject || '',
    color: client?.color || PALETTE[count % PALETTE.length],
    active: client ? client.active : true,
    phase: client?.phase || 'Kickoff',
    startDate: client?.startDate || '',
    goLiveDate: client?.goLiveDate || '',
    location: client?.location || '',
    erp: client?.erp || '',
    website: client?.website || '',
    engagementUrl: client?.engagementUrl || '',
    logo: client?.logo || null,
    logoBg: client?.logoBg || 'light',
  }));
  const [error, setError] = useState('');
  const [urlError, setUrlError] = useState('');
  const [logoError, setLogoError] = useState('');
  // A saved system that isn't in the list opens with "Other" selected and the name in the text box.
  const [erpOther, setErpOther] = useState(() => Boolean(client?.erp) && !ERP_SYSTEMS.includes(client.erp));
  const erpOtherRef = useRef(null);
  const set =(k) => (e) => setF((prev) => ({ ...prev, [k]: e?.currentTarget ? e.currentTarget.value : e }));

  const pickLogo = async (file) => {
    try {
      const { logo, logoBg } = await processLogo(file);
      setF((prev) => ({ ...prev, logo, logoBg }));
      setLogoError('');
    } catch (err) {
      setLogoError(err.message || String(err));
    }
  };
  usePasteImage(pickLogo);

  const save = () => {
    if (!f.name.trim()) return setError('Give the client a name.');
    const engagementUrl = normalizeUrl(f.engagementUrl);
    if (engagementUrl === null) return setUrlError('That doesn’t look like a web link. Paste the full address from your browser.');
    const fields = { ...f, name: f.name.trim(), kantataProject: f.kantataProject.trim(), erp: f.erp.trim(), website: normalizeUrl(f.website) || '', engagementUrl };
    if (client) {
      updateClient(client.id, fields);
      toast('Client saved', { icon: 'circle-check' });
    } else {
      const c = addClient(fields);
      toast(`Added ${c.name}`, { icon: 'building-2' });
      setUi({ clientId: c.id });
    }
    onClose();
  };

  return html`<${Modal} title=${client ? 'Edit client' : 'New client'} subtitle="Project details used across FieldLogger and in your Kantata notes" icon="building-2" onClose=${onClose} width=${620}
    footer=${html`<${Button} variant="ghost" onClick=${onClose}>Cancel<//><${Button} variant="primary" icon="check" onClick=${save}>${client ? 'Save client' : 'Add client'}<//>`}>
    <div class="form-stack" onKeyDown=${(e) => e.key === 'Enter' && e.ctrlKey && save()}>
      <div class="form-hero">
        <${ImageDrop} onFile=${pickLogo} tip="Upload a logo (click, drop or paste)">
          <${ClientAvatar} client=${{ name: f.name || '?', color: f.color, logo: f.logo, logoBg: f.logoBg }} size=${60} />
        <//>
        <${Field} label="Client name" error=${error} class="grow"><input class="input input-lg" value=${f.name} onInput=${(e) => { set('name')(e); setError(''); }} placeholder="e.g. Granite Ridge Paving" autofocus /><//>
      </div>
      <div class="logo-row">
        <div class="logo-row-text">
          <span class="field-label">Logo</span>
          ${logoError
            ? html`<span class="field-error">${logoError}</span>`
            : html`<span class="field-hint">PNG, JPG, SVG or WebP. Click the tile, drop a file on it, or paste one with Ctrl+V.</span>`}
        </div>
        ${f.logo && html`<${Segmented} size="sm" value=${f.logoBg} onChange=${(v) => setF((prev) => ({ ...prev, logoBg: v }))}
          options=${[{ value: 'light', label: 'Light', tip: 'Light plate behind the logo' }, { value: 'dark', label: 'Dark', tip: 'Dark plate, for white logos' }]} />`}
        <${Button} size="sm" icon="image-plus" onClick=${async () => { const file = await chooseImage(); if (file) pickLogo(file); }}>${f.logo ? 'Replace' : 'Upload logo'}<//>
        ${f.logo && html`<${Button} size="sm" variant="ghost" onClick=${() => setF((prev) => ({ ...prev, logo: null }))}>Remove<//>`}
      </div>
      <${Field} label="Kantata project" hint="Shows on Kantata Notes so you know exactly where to paste."><input class="input" value=${f.kantataProject} onInput=${set('kantataProject')} placeholder="e.g. GRP - B2W Estimate Implementation" /><//>
      <${Field} label="Engagement page" error=${urlError}
        hint="Paste the client's Kantata / Salesforce DX engagement URL. You'll get a one-click “Open engagement” button on the client page and Kantata Notes.">
        <div class="input-icon">
          <${Icon} name="link" size=${16} />
          <input class="input" value=${f.engagementUrl} onInput=${(e) => { set('engagementUrl')(e); setUrlError(''); }} placeholder="https://yourcompany.lightning.force.com/…" spellcheck=${false} />
        </div>
      <//>
      <div class="form-grid">
        <${Field} label="Phase">
          <select class="input" value=${f.phase} onChange=${set('phase')}>${PHASES.map((p) => html`<option value=${p}>${p}</option>`)}</select>
        <//>
        <${Field} label="Accounting / ERP">
          <div class="erp-select">
          ${f.erp && html`<${ErpLogo} erp=${f.erp} logos=${ERP_LOGOS} size=${36} />`}
          <select class="input" value=${erpOther ? '__other' : f.erp} onChange=${(e) => {
            const v = e.currentTarget.value;
            setErpOther(v === '__other');
            if (v === '__other') setTimeout(() => erpOtherRef.current?.focus());
            setF((prev) => ({ ...prev, erp: v === '__other' ? (ERP_SYSTEMS.includes(prev.erp) ? '' : prev.erp) : v }));
          }}>
            <option value="">Not set</option>
            ${ERP_SYSTEMS.map((x) => html`<option value=${x}>${x}</option>`)}
            <option value="__other">Other…</option>
          </select>
          </div>
          ${erpOther && html`<input class="input erp-other" value=${f.erp} onInput=${set('erp')} placeholder="System name, e.g. Acumatica" ref=${erpOtherRef} />`}
        <//>
        <${Field} label="Project start"><input class="input" type="date" value=${f.startDate} onInput=${set('startDate')} /><//>
        <${Field} label="Target go-live"><input class="input" type="date" value=${f.goLiveDate} onInput=${set('goLiveDate')} /><//>
        <${Field} label="Location"><input class="input" value=${f.location} onInput=${set('location')} placeholder="City, State" /><//>
        <${Field} label="Website"><input class="input" value=${f.website} onInput=${set('website')} placeholder="example.com" /><//>
      </div>
      <${Field} label="Color" group><${ColorPicker} value=${f.color} onChange=${(v) => setF({ ...f, color: v })} /><//>
      <${Switch} checked=${f.active} onChange=${(v) => setF({ ...f, active: v })} label="Active project" hint="Inactive clients are hidden from the Log Action picker but keep all their history." />
    </div>
  <//>`;
}

function ContactForm({ client, contact, onClose }) {
  const [f, setF] = useState(() => ({
    id: contact?.id, name: contact?.name || '', role: contact?.role || '', email: contact?.email || '', phone: contact?.phone || '',
    poc: contact ? Boolean(contact.poc) : !(client.contacts || []).some((k) => k.poc), notes: contact?.notes || '',
  }));
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });

  const save = () => {
    if (!f.name.trim()) return setError('Add a name.');
    saveContact(client.id, { ...f, name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim() });
    toast(contact ? 'Contact saved' : `Added ${f.name.trim()}`, { icon: 'user-round' });
    onClose();
  };
  const remove = async () => {
    const ok = await confirmDialog({ title: `Remove ${contact.name}?`, message: `They'll be removed from ${client.name}'s contacts.`, confirmLabel: 'Remove', danger: true });
    if (!ok) return;
    deleteContact(client.id, contact.id);
    onClose();
  };

  return html`<${Modal} title=${contact ? 'Edit contact' : 'Add contact'} subtitle=${client.name} icon="user-round" onClose=${onClose} width=${540}
    footer=${html`
      ${contact && html`<div class="foot-left"><${Button} variant="ghost-danger" icon="trash-2" onClick=${remove}>Remove<//></div>`}
      <${Button} variant="ghost" onClick=${onClose}>Cancel<//><${Button} variant="primary" icon="check" onClick=${save}>Save contact<//>`}>
    <div class="form-stack">
      <div class="form-grid">
        <${Field} label="Name" error=${error}><input class="input" value=${f.name} onInput=${(e) => { set('name')(e); setError(''); }} placeholder="Full name" autofocus /><//>
        <${Field} label="Role / title"><input class="input" value=${f.role} onInput=${set('role')} placeholder="e.g. Chief Estimator" /><//>
        <${Field} label="Email"><input class="input" type="email" value=${f.email} onInput=${set('email')} placeholder="name@company.com" /><//>
        <${Field} label="Phone"><input class="input" type="tel" value=${f.phone} onInput=${set('phone')} placeholder="(555) 555-0100" /><//>
      </div>
      <${Field} label="Notes"><textarea class="input textarea" rows="2" value=${f.notes} onInput=${set('notes')} placeholder="Best time to reach, preferences…"></textarea><//>
      <${Switch} checked=${f.poc} onChange=${(v) => setF({ ...f, poc: v })} label="Primary point of contact" hint="One POC per client. They're shown first on the client card." />
    </div>
  <//>`;
}
