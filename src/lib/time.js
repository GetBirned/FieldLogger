// Date/time helpers. Days are identified by local "YYYY-MM-DD" keys.

const pad = (n) => String(n).padStart(2, '0');

export const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayKey = () => dateKey(new Date());

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
export const addDaysKey = (key, n) => dateKey(addDays(parseKey(key), n));

export function addMonths(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth() + n, 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(date.getDate(), last));
  return d;
}

export function startOfWeek(date, weekStart = 1) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (d.getDay() - weekStart + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

export const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

// The 6x7 grid of days shown for a month.
export function monthGrid(date, weekStart = 1) {
  const first = startOfWeek(startOfMonth(date), weekStart);
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

export function weekDays(date, weekStart = 1, showWeekends = true) {
  const start = startOfWeek(date, weekStart);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return showWeekends ? days : days.filter((d) => d.getDay() !== 0 && d.getDay() !== 6);
}

export const minutesOfDay = (d) => d.getHours() * 60 + d.getMinutes();

export function fmtTime(date, hour12 = true) {
  const d = new Date(date);
  if (!hour12) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const h = d.getHours() % 12 || 12;
  return `${h}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

// "2:00-3:00 PM", "11:30 AM-12:30 PM", "14:00-15:00"
export function fmtRange(start, end, hour12 = true) {
  const s = new Date(start);
  const e = new Date(end);
  if (!hour12) return `${fmtTime(s, false)}-${fmtTime(e, false)}`;
  const sameHalf = (s.getHours() < 12) === (e.getHours() < 12);
  const sText = fmtTime(s, true);
  return `${sameHalf ? sText.replace(/ (AM|PM)$/, '') : sText}-${fmtTime(e, true)}`;
}

export function fmtHourLabel(hour, hour12 = true) {
  if (!hour12) return `${pad(hour)}:00`;
  const h = hour % 12 || 12;
  return `${h} ${hour < 12 || hour === 24 ? 'AM' : 'PM'}`;
}

export function fmtDuration(min) {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export function roundHours(min, roundTo = 0.25, mode = 'nearest') {
  const hours = min / 60;
  if (!roundTo) return Math.round(hours * 100) / 100;
  const steps = hours / roundTo;
  const rounded = (mode === 'up' ? Math.ceil(steps - 1e-9) : Math.round(steps)) * roundTo;
  return Math.round(rounded * 100) / 100;
}

export const fmtHours = (h) => {
  const s = (Math.round(h * 100) / 100).toFixed(2);
  return s.replace(/\.?0+$/, '') || '0';
};

const LONG = { weekday: 'long', month: 'long', day: 'numeric' };
export const fmtDateLong = (d) => new Date(d).toLocaleDateString(undefined, LONG);
export const fmtDateFull = (d) => new Date(d).toLocaleDateString(undefined, { ...LONG, year: 'numeric' });
export const fmtDateShort = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
export const fmtDateNumeric = (d) => new Date(d).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: 'numeric' });
export const fmtWeekday = (d, style = 'short') => new Date(d).toLocaleDateString(undefined, { weekday: style });
export const fmtMonthYear = (d) => new Date(d).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

export function fmtWeekRange(days) {
  const a = days[0];
  const b = days[days.length - 1];
  const sameMonth = a.getMonth() === b.getMonth();
  const left = a.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const right = b.toLocaleDateString(undefined, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' });
  return `${left} – ${right}, ${b.getFullYear()}`;
}

export function relativeTime(date) {
  if (!date) return 'never';
  const d = new Date(date);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400 && dateKey(d) === todayKey()) return `${Math.floor(diff / 3600)}h ago`;
  const days = Math.round((parseKey(todayKey()) - parseKey(dateKey(d))) / 86400000);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return fmtDateShort(d);
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return 'Burning the midnight oil';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// <input type="time"> helpers
export const toTimeInput = (d) => `${pad(new Date(d).getHours())}:${pad(new Date(d).getMinutes())}`;
export function combine(key, hhmm) {
  const d = parseKey(key);
  const [h, m] = (hhmm || '00:00').split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}
export const minutesToInput = (min) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;

export function fmtClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}
