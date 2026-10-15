// App-wide constants and the starting data for a new profile.

export const APP_NAME = 'FieldLogger';
export const DATA_VERSION = 1;

export const ACCENTS = [
  { id: 'safety', name: 'Safety Orange', value: '#f97316' },
  { id: 'hivis', name: 'Hi-Vis Amber', value: '#f5a524' },
  { id: 'lime', name: 'Survey Lime', value: '#84cc16' },
  { id: 'emerald', name: 'Emerald', value: '#10b981' },
  { id: 'teal', name: 'Teal', value: '#14b8a6' },
  { id: 'glacier', name: 'Glacier', value: '#0ea5e9' },
  { id: 'blueprint', name: 'Blueprint', value: '#3b82f6' },
  { id: 'indigo', name: 'Indigo', value: '#6366f1' },
  { id: 'violet', name: 'Violet', value: '#8b5cf6' },
  { id: 'flagging', name: 'Flagging Pink', value: '#ec4899' },
  { id: 'signal', name: 'Signal Red', value: '#ef4444' },
  { id: 'concrete', name: 'Concrete', value: '#64748b' },
];

// Company palettes. A swatch sets the accent plus its exact gradient partner
// (accent2); "apply" sets the whole look in one click.
export const BRAND_PALETTES = [
  {
    id: 'trimble',
    name: 'Trimble',
    desc: 'Trimble Blue accents with a Trimble Gray dark mode.',
    colors: [
      { name: 'Trimble Blue Dark', value: '#004f83' },
      { name: 'Trimble Blue', value: '#0063a3' },
      { name: 'Trimble Yellow', value: '#fbad26' },
      { name: 'Trimble Gray', value: '#252a2e' },
    ],
    apply: { accent: '#0063a3', accent2: '#004f83', darkStyle: 'trimble' },
    swatches: [
      { name: 'Trimble Blue', accent: '#0063a3', accent2: '#004f83' },
      { name: 'Trimble Blue Dark', accent: '#004f83', accent2: '#003a61' },
      { name: 'Trimble Yellow', accent: '#fbad26', accent2: '#f0920e' },
    ],
  },
  {
    id: 'b2w',
    name: 'B2W',
    desc: 'B2W red accents on clean white.',
    colors: [
      { name: 'B2W Red', value: '#982017' },
      { name: 'White', value: '#ffffff' },
      { name: 'B2W Dark Red', value: '#7a0b0a' },
    ],
    apply: { accent: '#982017', accent2: '#7a0b0a', darkStyle: 'midnight' },
    swatches: [
      { name: 'B2W Red', accent: '#982017', accent2: '#7a0b0a' },
      { name: 'B2W Dark Red', accent: '#7a0b0a', accent2: '#5a0706' },
    ],
  },
];

// Colors used for clients, avatars and action types.
export const PALETTE = [
  '#3b82f6', '#06b6d4', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#f97316', '#ef4444',
  '#eab308', '#6366f1', '#14b8a6', '#84cc16', '#64748b', '#a855f7', '#0ea5e9', '#f43f5e',
];

export const DEFAULT_ACTION_TYPES = [
  { id: 'call', name: 'Phone Call', icon: 'phone', color: '#3b82f6', minutes: 30 },
  { id: 'email', name: 'Email', icon: 'mail', color: '#06b6d4', minutes: 15 },
  { id: 'dbpop', name: 'Database Population', icon: 'database', color: '#8b5cf6', minutes: 60 },
  { id: 'template', name: 'Template Walkthrough', icon: 'layout-template', color: '#ec4899', minutes: 60 },
  { id: 'access', name: 'Confirm Client Access', icon: 'key-round', color: '#10b981', minutes: 15 },
  { id: 'training-handoff', name: 'Training Handoff', icon: 'graduation-cap', color: '#f59e0b', minutes: 30 },
  { id: 'sales-handoff', name: 'Sales Handoff', icon: 'handshake', color: '#f97316', minutes: 30 },
  { id: 'kickoff', name: 'Kickoff Meeting', icon: 'rocket', color: '#ef4444', minutes: 60 },
  { id: 'training', name: 'Training Session', icon: 'presentation', color: '#eab308', minutes: 90 },
  { id: 'config', name: 'Configuration', icon: 'settings-2', color: '#6366f1', minutes: 60 },
  { id: 'import-review', name: 'Data Import Review', icon: 'file-spreadsheet', color: '#14b8a6', minutes: 30 },
  { id: 'golive', name: 'Go-Live Support', icon: 'zap', color: '#84cc16', minutes: 60 },
  { id: 'internal', name: 'Internal Meeting', icon: 'users', color: '#64748b', minutes: 30 },
  { id: 'docs', name: 'Documentation', icon: 'file-text', color: '#a855f7', minutes: 30 },
];

// Icons offered in the action-type editor.
export const ACTION_ICONS = [
  'phone', 'phone-call', 'headset', 'mail', 'mail-check', 'send', 'message-square', 'video', 'monitor-play',
  'database', 'server', 'table', 'sheet', 'file-spreadsheet', 'cloud-upload', 'layout-template', 'file-text',
  'clipboard-check', 'clipboard-list', 'list-checks', 'key-round', 'shield-check', 'lock', 'graduation-cap',
  'presentation', 'handshake', 'users', 'rocket', 'zap', 'settings-2', 'wrench', 'hammer', 'hard-hat',
  'construction', 'truck', 'shovel', 'ruler', 'drafting-compass', 'map-pin', 'map', 'flag', 'target',
  'lightbulb', 'sparkles', 'bookmark', 'sticky-note', 'calendar-check', 'briefcase', 'building-2', 'globe',
  'search', 'refresh-cw', 'badge-check', 'party-popper',
];

// Accounting / ERP systems offered on the client form. Anything else is typed in as "Other".
export const ERP_SYSTEMS = ['Vista', 'Spectrum', 'Sage 100', 'Sage 300', 'Sage 50', 'QuickBooks', 'Foundation'];

export const PHASES = ['Sales Handoff', 'Kickoff', 'Data Setup', 'Configuration', 'Training', 'Go-Live', 'Complete'];

export const NOTE_TOKENS = [
  { token: '{time}', label: 'Time', hint: '2:15 PM or 2:00-3:00 PM' },
  { token: '{event}', label: 'Event', hint: 'Phone Call' },
  { token: '{notes}', label: 'Notes', hint: 'your extra notes' },
  { token: '{client}', label: 'Client', hint: 'Granite Ridge Paving' },
  { token: '{project}', label: 'Kantata project', hint: 'GRP - Implementation' },
  { token: '{duration}', label: 'Duration', hint: '1h 15m' },
  { token: '{hours}', label: 'Hours', hint: '1.25' },
  { token: '{date}', label: 'Date', hint: '10/14/2026' },
];

export const DEFAULT_TEMPLATE = '{time}: {event} - {notes}';

export const DEFAULT_SETTINGS = {
  theme: 'system', // 'light' | 'dark' | 'system'
  accent: '#f97316',
  accent2: null, // exact gradient partner for brand colors; null = derived from accent
  darkStyle: 'midnight', // 'midnight' | 'trimble' (Trimble Gray surfaces)
  aurora: true,
  density: 'comfortable', // calendar hour height
  colorBy: 'type', // 'type' | 'client'
  dayStart: 7,
  dayEnd: 19,
  weekStart: 1, // 0 Sunday, 1 Monday
  showWeekends: false,
  hour12: true,
  defaultView: 'day',
  template: DEFAULT_TEMPLATE,
  roundTo: 0.25,
  roundMode: 'nearest', // 'nearest' | 'up'
  dailyTarget: 8,
  zoom: 1,
  sidebarCollapsed: false,
  notesGroup: 'client', // 'client' | 'time'
  autoMarkOnCopy: true,
};

export function freshData(profile) {
  return {
    version: DATA_VERSION,
    profileId: profile.id,
    settings: { ...DEFAULT_SETTINGS },
    actionTypes: DEFAULT_ACTION_TYPES.map((t) => ({ ...t, archived: false })),
    clients: [],
    entries: [],
    timer: null,
  };
}

// Fills any missing pieces so older or hand-edited files keep working.
export function normalizeData(raw, profile) {
  const base = freshData(profile);
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    version: DATA_VERSION,
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings || {}) },
    actionTypes: Array.isArray(raw.actionTypes) && raw.actionTypes.length ? raw.actionTypes : base.actionTypes,
    clients: Array.isArray(raw.clients) ? raw.clients.map((c) => ({ contacts: [], notes: '', active: true, ...c })) : [],
    entries: Array.isArray(raw.entries) ? raw.entries.filter((e) => e && e.start) : [],
    timer: raw.timer && raw.timer.start ? raw.timer : null,
  };
}

export const uid = (prefix = '') => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
