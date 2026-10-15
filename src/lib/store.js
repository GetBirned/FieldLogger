// Application state: the signed-in profile's data (persisted) and transient UI
// state (page, selected date, open dialogs, toasts).
import { useState, useEffect } from './h.js';
import { bridge } from './bridge.js';
import { normalizeData, freshData, uid, isNewerData, DEFAULT_ACTION_TYPES } from './defaults.js';
import { todayKey } from './time.js';
import { buildDemoData } from './demo.js';

function createStore(initial) {
  let state = initial;
  const subs = new Set();
  return {
    get: () => state,
    set(next) {
      state = typeof next === 'function' ? next(state) : next;
      subs.forEach((f) => f(state));
    },
    subscribe(f) {
      subs.add(f);
      return () => subs.delete(f);
    },
  };
}

// readOnly: the data was saved by a newer FieldLogger, so nothing is saved back.
export const session = createStore({ profile: null, data: null, readOnly: false });
export const ui = createStore({
  recovery: null, // { profile, message } when a profile's data file couldn't be read
  page: 'calendar',
  calView: 'day',
  date: todayKey(),
  clientId: null,
  settingsTab: 'appearance',
  log: null,
  confirm: null,
  toasts: [],
});

export function useStore(store) {
  const [, force] = useState(0);
  useEffect(() => store.subscribe(() => force((x) => x + 1)), [store]);
  return store.get();
}

export const useSession = () => useStore(session);
export const useUi = () => useStore(ui);
export const setUi = (patch) => ui.set((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));

// ------------------------------------------------------------------ persistence

let saveTimer = null;
let dirty = false;

function scheduleSave() {
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 350);
}

export async function flush() {
  clearTimeout(saveTimer);
  const { profile, data, readOnly } = session.get();
  if (!dirty || !profile || !data || readOnly) return;
  dirty = false;
  try {
    await bridge.data.save(profile.id, data);
  } catch (err) {
    dirty = true;
    toast(`Couldn't save: ${err.message || err}`, { tone: 'error' });
  }
}

export function flushSync() {
  const { profile, data, readOnly } = session.get();
  if (!dirty || !profile || !data || readOnly) return;
  bridge.data.saveSync(profile.id, data);
  dirty = false;
}

if (typeof window !== 'undefined') window.addEventListener('beforeunload', flushSync);

export function updateData(fn) {
  const s = session.get();
  if (!s.data) return;
  if (s.readOnly) {
    toast('Read-only: this data was saved by a newer FieldLogger. Install the latest version to make changes.', { tone: 'error', icon: 'lock' });
    return;
  }
  const next = fn(s.data);
  if (!next || next === s.data) return;
  session.set({ ...s, data: next });
  scheduleSave();
}

const now = () => new Date().toISOString();
const patchList = (list, id, patch) => list.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: now() } : x));

// ---------------------------------------------------------------------- session

export async function signIn(profile) {
  // Register the visit first: if the profile isn't on file, write nothing.
  const touched = await bridge.profiles.touch(profile.id);
  if (!touched) throw new Error('That profile is no longer on this computer.');
  let raw;
  try {
    raw = await bridge.data.load(profile.id);
  } catch (err) {
    // The file exists but can't be read. Never start empty over it: ask to restore a backup.
    if (String(err?.message).includes('FL_UNREADABLE')) {
      ui.set((s) => ({ ...s, recovery: { profile: touched } }));
      throw new Error(`${touched.name}'s data couldn't be read, so nothing was changed. Restore a backup to continue.`);
    }
    throw err;
  }
  // null means there is no data file yet (a brand new profile).
  const data = raw ? normalizeData(raw, touched) : freshData(touched);
  if (!raw) await bridge.data.save(profile.id, data);
  ui.set((s) => ({ ...s, page: 'calendar', calView: data.settings.defaultView || 'day', date: todayKey(), clientId: null, log: null, confirm: null, recovery: null }));
  session.set({ profile: touched, data, readOnly: isNewerData(raw) });
}

// Re-read the signed-in profile's data from disk (after restoring a backup).
export async function reloadData() {
  const { profile } = session.get();
  clearTimeout(saveTimer);
  dirty = false;
  const raw = await bridge.data.load(profile.id);
  const data = raw ? normalizeData(raw, profile) : freshData(profile);
  session.set({ profile, data, readOnly: isNewerData(raw) });
  return data;
}

// Lock keeps you as the last profile, so the launch screen asks for your PIN.
export async function lock() {
  await flush();
  session.set({ profile: null, data: null, readOnly: false });
}

// Switching forgets the last profile, so the launch screen shows the picker.
export async function signOut() {
  await flush();
  await bridge.profiles.forget();
  session.set({ profile: null, data: null, readOnly: false });
}

export async function updateProfile(patch) {
  const { profile } = session.get();
  const next = await bridge.profiles.update(profile.id, patch);
  session.set((s) => ({ ...s, profile: next }));
  return next;
}

export async function setProfilePin(pin) {
  const { profile } = session.get();
  const next = await bridge.profiles.setPin(profile.id, pin);
  session.set((s) => ({ ...s, profile: next }));
  return next;
}

// ------------------------------------------------------------------------- toasts

export function toast(message, opts = {}) {
  const id = uid('t');
  const t = { id, message, tone: opts.tone || 'success', action: opts.action || null, icon: opts.icon || null };
  ui.set((s) => ({ ...s, toasts: [...s.toasts.slice(-3), t] }));
  setTimeout(() => dismissToast(id), opts.duration || (opts.action ? 6000 : 3200));
  return id;
}
export const dismissToast = (id) => ui.set((s) => ({ ...s, toasts: s.toasts.filter((t) => t.id !== id) }));

export function confirmDialog(opts) {
  return new Promise((resolve) => {
    ui.set((s) => ({ ...s, confirm: { ...opts, resolve } }));
  });
}
export function closeConfirm(result) {
  const c = ui.get().confirm;
  ui.set((s) => ({ ...s, confirm: null }));
  c?.resolve(result);
}

export async function copyText(text, label = 'Copied to clipboard') {
  await bridge.clipboard.write(text);
  toast(label, { icon: 'copy-check' });
}

// ---------------------------------------------------------------------- navigation

export const nav = (page, extra = {}) => setUi({ page, ...extra });
export const openLog = (prefill = {}) => setUi({ log: { mode: 'create', prefill } });
export const openEdit = (entryId) => setUi({ log: { mode: 'edit', entryId } });
export const closeLog = () => setUi({ log: null });

// ------------------------------------------------------------------------ entries

export function addEntry(fields) {
  const entry = { id: uid('e'), notes: '', minutes: null, end: null, clientId: null, entered: false, createdAt: now(), updatedAt: now(), ...fields };
  updateData((d) => ({ ...d, entries: [...d.entries, entry] }));
  return entry;
}

export const updateEntry = (id, patch) => updateData((d) => ({ ...d, entries: patchList(d.entries, id, patch) }));

export function deleteEntry(id) {
  const entry = session.get().data.entries.find((e) => e.id === id);
  updateData((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== id) }));
  if (entry) {
    toast('Entry deleted', {
      tone: 'info',
      icon: 'trash-2',
      action: { label: 'Undo', run: () => updateData((d) => ({ ...d, entries: [...d.entries, entry] })) },
    });
  }
}

export function setEntered(ids, entered) {
  const set = new Set(ids);
  updateData((d) => ({
    ...d,
    entries: d.entries.map((e) => (set.has(e.id) ? { ...e, entered, enteredAt: entered ? now() : null } : e)),
  }));
}

// -------------------------------------------------------------------------- timer

export function startTimer({ typeId, clientId, notes }) {
  updateData((d) => ({ ...d, timer: { typeId, clientId: clientId || null, notes: notes || '', start: now() } }));
}

export function stopTimer() {
  const { timer } = session.get().data;
  if (!timer) return null;
  const end = new Date();
  // Anything under a minute still counts as one minute so it shows on the calendar.
  const start = new Date(Math.min(new Date(timer.start).getTime(), end.getTime() - 60000));
  updateData((d) => ({ ...d, timer: null }));
  return addEntry({ typeId: timer.typeId, clientId: timer.clientId, notes: timer.notes, start: start.toISOString(), end: end.toISOString() });
}

export const discardTimer = () => updateData((d) => ({ ...d, timer: null }));
export const updateTimer = (patch) => updateData((d) => (d.timer ? { ...d, timer: { ...d.timer, ...patch } } : d));

// ------------------------------------------------------------------------ clients

export function addClient(fields) {
  const client = {
    id: uid('c'),
    name: 'New client',
    active: true,
    color: '#3b82f6',
    kantataProject: '',
    customerCode: '',
    implementations: [],
    startDate: '',
    goLiveDate: '',
    website: '',
    location: '',
    erp: '',
    engagementUrl: '',
    logo: null,
    logoBg: 'light',
    notes: '',
    contacts: [],
    createdAt: now(),
    updatedAt: now(),
    ...fields,
  };
  updateData((d) => ({ ...d, clients: [...d.clients, client] }));
  return client;
}

export const updateClient = (id, patch) => updateData((d) => ({ ...d, clients: patchList(d.clients, id, patch) }));

export function deleteClient(id) {
  updateData((d) => ({
    ...d,
    clients: d.clients.filter((c) => c.id !== id),
    entries: d.entries.map((e) => (e.clientId === id ? { ...e, clientId: null } : e)),
    timer: d.timer && d.timer.clientId === id ? { ...d.timer, clientId: null } : d.timer,
  }));
}

// ----------------------------------------------------------------- implementations
// A client's implementations: { id, product, done: { [milestoneId]: ISO date }, complete, completedAt, createdAt }.

export const newImplementation = (product) => ({ id: uid('i'), product, done: {}, complete: false, completedAt: null, createdAt: now() });

function patchImplementations(clientId, fn) {
  updateData((d) => ({
    ...d,
    clients: d.clients.map((c) => (c.id === clientId ? { ...c, implementations: fn(c.implementations || []), updatedAt: now() } : c)),
  }));
}

export const addImplementation = (clientId, product) => patchImplementations(clientId, (list) => [...list, newImplementation(product)]);
export const removeImplementation = (clientId, implId) => patchImplementations(clientId, (list) => list.filter((i) => i.id !== implId));

export function toggleMilestone(clientId, implId, milestoneId) {
  patchImplementations(clientId, (list) => list.map((i) => {
    if (i.id !== implId) return i;
    const done = { ...i.done };
    if (done[milestoneId]) delete done[milestoneId];
    else done[milestoneId] = now();
    return { ...i, done };
  }));
}

export function setImplementationComplete(clientId, implId, complete) {
  patchImplementations(clientId, (list) => list.map((i) => (i.id === implId ? { ...i, complete, completedAt: complete ? now() : null } : i)));
}

export function saveContact(clientId, contact) {
  updateData((d) => ({
    ...d,
    clients: d.clients.map((c) => {
      if (c.id !== clientId) return c;
      let contacts = c.contacts || [];
      if (contact.poc) contacts = contacts.map((x) => ({ ...x, poc: false }));
      const exists = contacts.some((x) => x.id === contact.id);
      contacts = exists ? contacts.map((x) => (x.id === contact.id ? contact : x)) : [...contacts, { ...contact, id: contact.id || uid('k') }];
      return { ...c, contacts, updatedAt: now() };
    }),
  }));
}

export function deleteContact(clientId, contactId) {
  updateData((d) => ({
    ...d,
    clients: d.clients.map((c) => (c.id === clientId ? { ...c, contacts: c.contacts.filter((x) => x.id !== contactId) } : c)),
  }));
}

// ------------------------------------------------------------------- action types

export function saveActionType(type) {
  updateData((d) => {
    const exists = d.actionTypes.some((t) => t.id === type.id);
    return {
      ...d,
      actionTypes: exists ? d.actionTypes.map((t) => (t.id === type.id ? { ...t, ...type } : t)) : [...d.actionTypes, { archived: false, ...type, id: type.id || uid('a') }],
    };
  });
}

export function deleteActionType(id) {
  updateData((d) => ({ ...d, actionTypes: d.actionTypes.filter((t) => t.id !== id) }));
}

export function moveActionType(id, dir) {
  updateData((d) => {
    const list = d.actionTypes.slice();
    const i = list.findIndex((t) => t.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return d;
    [list[i], list[j]] = [list[j], list[i]];
    return { ...d, actionTypes: list };
  });
}

export function restoreDefaultActionTypes() {
  updateData((d) => {
    const have = new Set(d.actionTypes.map((t) => t.id));
    const missing = DEFAULT_ACTION_TYPES.filter((t) => !have.has(t.id)).map((t) => ({ ...t, archived: false }));
    return { ...d, actionTypes: [...d.actionTypes.map((t) => (DEFAULT_ACTION_TYPES.some((x) => x.id === t.id) ? { ...t, archived: false } : t)), ...missing] };
  });
}

// ----------------------------------------------------------------------- settings

export const setSettings = (patch) => updateData((d) => ({ ...d, settings: { ...d.settings, ...patch } }));

// --------------------------------------------------------------------------- data

export function replaceData(raw) {
  const { profile } = session.get();
  const data = normalizeData(raw, profile);
  updateData(() => ({ ...data, profileId: profile.id }));
}

export function loadDemo() {
  updateData((d) => {
    const demo = buildDemoData(d.actionTypes);
    return { ...d, clients: [...d.clients.filter((c) => !c.demo), ...demo.clients], entries: [...d.entries.filter((e) => !e.demo), ...demo.entries] };
  });
}

export function removeDemo() {
  updateData((d) => ({ ...d, clients: d.clients.filter((c) => !c.demo), entries: d.entries.filter((e) => !e.demo) }));
}
