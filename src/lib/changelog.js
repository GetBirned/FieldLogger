// Release notes shown in Settings → Update log, newest first.
// Each release: bump "version" in package.json and add an entry here with the same version.
// Item kinds: 'new' | 'improved' | 'fixed'.

export const CHANGELOG = [
  {
    version: '1.3.0',
    date: '2026-10-14',
    title: 'Implementations and Kantata milestones',
    items: [
      { kind: 'new', text: 'Mark which products a client is implementing: Estimate, Track, Schedule, Maintain and Field Employee. Pick as many as you need, and add more later from the client page.' },
      { kind: 'new', text: 'Each implementation has its Kantata plan milestones as a checklist. Ticking one records the date.' },
      { kind: 'new', text: 'Mark an implementation complete (and reopen it if needed). Client cards show each implementation’s progress.' },
      { kind: 'improved', text: 'Implementations replace the old single phase stepper.' },
      { kind: 'new', text: 'Customer code for each client (like WARD). It shows next to the client name, is searchable, copies in one click, and can go in Kantata notes with {code}.' },
      { kind: 'improved', text: 'Signing in with a PIN unlocks as soon as you type the right PIN. No need to press Unlock.' },
    ],
  },
  {
    version: '1.2.0',
    date: '2026-10-14',
    title: 'ERP logos',
    items: [
      { kind: 'new', text: 'Each client’s ERP system now shows its logo on the client card, the client page and the client form.' },
      { kind: 'new', text: 'ComputerEase added to the ERP list.' },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-10-14',
    title: 'ERP systems and a new look',
    items: [
      { kind: 'new', text: 'Pick each client’s accounting / ERP system: Vista, Spectrum, Sage 100, Sage 300, Sage 50, QuickBooks, Foundation, or type your own.' },
      { kind: 'new', text: 'The ERP system shows on the client page, and client search matches it.' },
      { kind: 'new', text: 'Update log in Settings, so you can see what changed in each version.' },
      { kind: 'improved', text: 'New FieldLogger logo and app icon. In the app it follows your accent color.' },
      { kind: 'improved', text: 'Client form is more compact: location and website sit next to the dates.' },
      { kind: 'improved', text: 'Cleaner sign-in screen without the tagline.' },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-10-14',
    title: 'First release',
    items: [
      { kind: 'new', text: 'Log client actions on a day, week or month calendar, with a running timer and quick-log buttons.' },
      { kind: 'new', text: 'Kantata Notes: copy-ready lines for each entry, grouped by client, with check-off as you paste.' },
      { kind: 'new', text: 'Clients with phases, contacts, notes, logos and a one-click engagement link.' },
      { kind: 'new', text: 'Profiles with optional PINs and profile pictures, plus daily backups.' },
      { kind: 'new', text: 'Trimble and B2W brand palettes, accent colors and a Trimble Gray dark mode.' },
      { kind: 'fixed', text: 'Profiles whose data exists but went missing from the profile list are recovered automatically.' },
    ],
  },
];

export const LATEST_VERSION = CHANGELOG[0].version;
