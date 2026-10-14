// Sample clients and entries for exploring the app. Everything created here is
// tagged demo:true so Settings -> Data can remove it in one click.
import { uid } from './defaults.js';
import { addDays } from './time.js';

// Simple made-up marks so the sample data shows client logos.
const DEMO_LOGOS = {
  granite: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M4 48 24 16l10 15 8-10 18 27Z" fill="#334155"/><path d="m24 16 5 8-5-2-5 2Z" fill="#fff"/><path d="M8 55h48" stroke="#f97316" stroke-width="5" stroke-linecap="round"/></svg>`,
  mesa: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="45" cy="19" r="9" fill="#f59e0b"/><path d="M5 50 16 29h28l15 21Z" fill="#0e7490"/><path d="M5 52h54" stroke="#164e63" stroke-width="4" stroke-linecap="round"/></svg>`,
  ironwood: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="27" fill="#4c1d95"/><circle cx="32" cy="32" r="19" fill="none" stroke="#c4b5fd" stroke-width="3"/><circle cx="33" cy="31" r="11" fill="none" stroke="#c4b5fd" stroke-width="3"/><circle cx="33" cy="31" r="4" fill="#c4b5fd"/></svg>`,
};
const svgUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const CLIENTS = [
  {
    name: 'Granite Ridge Paving', color: '#f97316', kantataProject: 'GRP - B2W Estimate & Track Implementation', phase: 'Configuration',
    logo: DEMO_LOGOS.granite, engagement: 'https://example.com/engagements/granite-ridge',
    location: 'Boise, ID', website: 'https://example.com', start: -34, golive: 41,
    notes: 'Estimating team of 6. Wants bid item templates mirrored from their old spreadsheets.\nPrimary pain point: equipment rate tables.',
    contacts: [
      { name: 'Jamie Ortiz', role: 'Chief Estimator', email: 'jamie.ortiz@example.com', phone: '(208) 555-0142', poc: true },
      { name: 'Priya Nair', role: 'IT Manager', email: 'priya.nair@example.com', phone: '(208) 555-0177' },
    ],
  },
  {
    name: 'Summit Civil Constructors', color: '#3b82f6', kantataProject: 'SCC - Schedule & Maintain Rollout', phase: 'Training',
    location: 'Denver, CO', start: -61, golive: 12,
    notes: 'Field supervisors trained in two waves. Wave 2 scheduled after Thanksgiving.',
    contacts: [
      { name: 'Marcus Bell', role: 'Operations Director', email: 'mbell@example.com', phone: '(303) 555-0108', poc: true },
      { name: 'Lena Fischer', role: 'Payroll Lead', email: 'lfischer@example.com', phone: '(303) 555-0119' },
    ],
  },
  {
    name: 'Blue Mesa Excavation', color: '#10b981', kantataProject: 'BME - Track Implementation', phase: 'Data Setup',
    logo: DEMO_LOGOS.mesa, engagement: 'https://example.com/engagements/blue-mesa',
    location: 'Albuquerque, NM', start: -12, golive: 70,
    notes: 'Needs cost code import from Viewpoint export. Waiting on final employee list.',
    contacts: [{ name: 'Rosa Delgado', role: 'Controller', email: 'rosa.d@example.com', phone: '(505) 555-0163', poc: true }],
  },
  {
    name: 'Ironwood Aggregates', color: '#8b5cf6', kantataProject: 'IWA - Estimate Upgrade', phase: 'Kickoff',
    logo: DEMO_LOGOS.ironwood,
    location: 'Tulsa, OK', start: -3, golive: 95,
    notes: 'Sales handoff complete. Kickoff deck sent.',
    contacts: [{ name: 'Dale Hutchins', role: 'VP Construction', email: 'dhutchins@example.com', phone: '(918) 555-0131', poc: true }],
  },
  {
    name: 'Cascade Earthworks', color: '#ec4899', kantataProject: 'CEW - B2W Suite', phase: 'Complete',
    location: 'Tacoma, WA', start: -160, golive: -20, active: false,
    notes: 'Live since September. Handed off to support.',
    contacts: [{ name: 'Sam Whitaker', role: 'Project Controls', email: 'sam.w@example.com', phone: '(253) 555-0190', poc: true }],
  },
];

const NOTES = {
  call: ['Weekly status call - reviewed open items', 'Walked through import errors with Jamie', 'Discussed training schedule', 'Clarified cost code structure', 'Quick check-in on go-live readiness'],
  email: ['Sent recap and next steps', 'Followed up on missing employee list', 'Shared template checklist', 'Answered questions on rate tables'],
  dbpop: ['Loaded equipment and rates', 'Imported 412 cost codes', 'Populated crews and employees', 'Built bid item library'],
  template: ['Walked estimators through bid templates', 'Reviewed daily log template with supers'],
  access: ['Confirmed all users can sign in', 'Verified license assignments'],
  'training-handoff': ['Handed off to training team with notes'],
  'sales-handoff': ['Reviewed SOW and scope with sales'],
  kickoff: ['Project kickoff - goals, timeline, roles'],
  training: ['Admin training session', 'Field supervisor training wave 1'],
  config: ['Configured approval workflows', 'Set up job templates', 'Mapped pay classes'],
  'import-review': ['Reviewed import file before load', 'Validated job cost mapping'],
  golive: ['Go-live hypercare - field questions'],
  internal: ['Team sync', 'Implementation standup'],
  docs: ['Updated project notes and decisions log', 'Wrote configuration summary'],
};

// Small deterministic random so the sample looks the same every time.
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function buildDemoData(actionTypes) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const iso = (d) => d.toISOString();

  const clients = CLIENTS.map((c) => ({
    id: uid('c'),
    name: c.name,
    active: c.active !== false,
    color: c.color,
    kantataProject: c.kantataProject,
    phase: c.phase,
    location: c.location || '',
    website: c.website || '',
    engagementUrl: c.engagement || '',
    logo: c.logo ? svgUrl(c.logo) : null,
    logoBg: 'light',
    startDate: iso(addDays(today, c.start)).slice(0, 10),
    goLiveDate: iso(addDays(today, c.golive)).slice(0, 10),
    notes: c.notes,
    contacts: c.contacts.map((k) => ({ id: uid('k'), notes: '', poc: false, ...k })),
    createdAt: iso(addDays(today, c.start)),
    updatedAt: iso(today),
    demo: true,
  }));

  const types = actionTypes.filter((t) => !t.archived && NOTES[t.id]);
  const active = clients.filter((c) => c.active);
  const rand = rng(20261014);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const entries = [];
  const nowMs = Date.now();

  for (let offset = -13; offset <= 0; offset++) {
    const day = addDays(today, offset);
    if (day.getDay() === 0 || day.getDay() === 6) continue;
    let minute = 8 * 60 + Math.floor(rand() * 4) * 15;
    const count = offset === 0 ? 6 : 4 + Math.floor(rand() * 4);
    for (let i = 0; i < count; i++) {
      const type = pick(types);
      const client = type.id === 'internal' ? null : pick(active);
      const start = new Date(day);
      start.setHours(0, minute, 0, 0);
      const ranged = type.minutes >= 30 && rand() > 0.25;
      const length = ranged ? Math.max(30, Math.round((type.minutes * (0.75 + rand() * 0.75)) / 15) * 15) : type.minutes;
      const end = new Date(start.getTime() + length * 60000);
      if (end.getTime() > nowMs) break;
      entries.push({
        id: uid('e'),
        typeId: type.id,
        clientId: client?.id || null,
        start: iso(start),
        end: ranged ? iso(end) : null,
        minutes: ranged ? null : type.minutes,
        notes: pick(NOTES[type.id]),
        entered: offset < -1 || (offset === -1 && rand() > 0.5),
        createdAt: iso(start),
        updatedAt: iso(start),
        demo: true,
      });
      minute += length + 15 + Math.floor(rand() * 4) * 15;
      if (minute > 17 * 60) break;
    }
  }

  return { clients, entries };
}
