// Turns logged entries into Kantata-ready note lines and CSV exports.
import { fmtTime, fmtRange, fmtDuration, roundHours, fmtHours, fmtDateNumeric, dateKey } from './time.js';
import { DEFAULT_TEMPLATE, implementationDef } from './defaults.js';

// The implementation (Estimate, Track, …) an entry was logged against, if it still exists.
export function entryImplementation(entry, client) {
  const impl = entry.implementationId && (client?.implementations || []).find((i) => i.id === entry.implementationId);
  return impl ? { impl, def: implementationDef(impl.product) } : null;
}

export const entryMinutes = (e) => (e.end ? Math.max(0, (new Date(e.end) - new Date(e.start)) / 60000) : Number(e.minutes) || 0);

export const entryTimeText = (e, hour12 = true) => (e.end ? fmtRange(e.start, e.end, hour12) : fmtTime(e.start, hour12));

// Fill the template, then tidy separators left dangling by empty tokens
// ("2:15 PM: Email - " becomes "2:15 PM: Email").
export function renderLine(entry, { type, client, settings }) {
  const template = settings?.template || DEFAULT_TEMPLATE;
  const minutes = entryMinutes(entry);
  const values = {
    time: entryTimeText(entry, settings?.hour12 !== false),
    event: type?.name || 'Action',
    notes: (entry.notes || '').replace(/\s*\n+\s*/g, '; ').trim(),
    client: client?.name || 'Internal',
    project: client?.kantataProject || client?.name || 'Internal',
    code: client?.customerCode || '',
    implementation: entryImplementation(entry, client)?.def.name || '',
    duration: minutes ? fmtDuration(minutes) : '',
    hours: minutes ? fmtHours(roundHours(minutes, settings?.roundTo, settings?.roundMode)) : '',
    date: fmtDateNumeric(entry.start),
  };
  return template
    .replace(/\{(\w+)\}/g, (m, k) => (k in values ? values[k] : m))
    .replace(/\(\s*\)|\[\s*\]/g, '')
    .replace(/(\s*[-–—|:,;]\s*)+$/g, '')
    .replace(/^\s*[-–—|:,;]\s*/g, '')
    .replace(/\s*([-–—|])\s*(?=[-–—|])/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export const entriesOnDay = (entries, key) => entries
  .filter((e) => dateKey(new Date(e.start)) === key)
  .sort((a, b) => new Date(a.start) - new Date(b.start));

export function totalMinutes(entries) {
  return entries.reduce((sum, e) => sum + entryMinutes(e), 0);
}

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function entriesToCsv(entries, { typeById, clientById, settings }) {
  const header = ['Date', 'Start', 'End', 'Client', 'Project', 'Action', 'Hours', 'Minutes', 'Notes', 'Note line', 'Entered'];
  const rows = entries
    .slice()
    .sort((a, b) => new Date(a.start) - new Date(b.start))
    .map((e) => {
      const type = typeById[e.typeId];
      const client = clientById[e.clientId];
      const minutes = entryMinutes(e);
      return [
        fmtDateNumeric(e.start),
        fmtTime(e.start, settings.hour12),
        e.end ? fmtTime(e.end, settings.hour12) : '',
        client?.name || 'Internal',
        client?.kantataProject || '',
        type?.name || '',
        minutes ? fmtHours(roundHours(minutes, settings.roundTo, settings.roundMode)) : '',
        Math.round(minutes),
        e.notes || '',
        renderLine(e, { type, client, settings }),
        e.entered ? 'Yes' : 'No',
      ];
    });
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}
