// Release notes shown in Settings → Update log, newest first.
// Each release: bump "version" in package.json and add an entry here with the same version.
// Item kinds: 'new' | 'improved' | 'fixed'.

export const CHANGELOG = [
  {
    version: '1.6.1',
    date: '2026-10-15',
    title: 'Window always opens where you can see it',
    items: [
      { kind: 'fixed', text: 'If FieldLogger was last used on a monitor that isn’t connected now, its window opened off-screen. It now opens centered on your main screen.' },
      { kind: 'fixed', text: 'Opening FieldLogger while it’s already running brings its window back into view.' },
    ],
  },
  {
    version: '1.6.0',
    date: '2026-10-14',
    title: 'Update in one click',
    items: [
      { kind: 'new', text: 'FieldLogger checks your team’s shared update folder and lets you know when a new version is ready, with what changed.' },
      { kind: 'new', text: 'Update now saves your work, installs the new version and reopens FieldLogger. A full copy of your data is kept first.' },
      { kind: 'new', text: 'Choose the update folder, or check right away, in Settings → Updates.' },
      { kind: 'improved', text: 'Installers are verified before they run, so a damaged or half-copied file is never installed.' },
    ],
  },
  {
    version: '1.5.0',
    date: '2026-10-14',
    title: 'Logged work moves milestones',
    items: [
      { kind: 'new', text: 'Log Action asks which implementation the work is for (Estimate, Track, …). With one implementation in progress it’s picked for you.' },
      { kind: 'new', text: 'Actions that count toward a milestone offer to tick it as you log, dated the day of the work. Sales Handoff, Confirm Client Access, Training Handoff, Database Population and Template Walkthrough are linked already.' },
      { kind: 'new', text: 'Link your own action types to a milestone in Settings → Action types.' },
      { kind: 'improved', text: 'The notes page is now simply called Notes, with simpler wording throughout.' },
      { kind: 'improved', text: 'Simpler PIN screen: just type your PIN. The prompt text and Unlock button are gone.' },
      { kind: 'new', text: 'Each implementation shows the hours logged against it, client activity shows which implementation each entry was for, and notes can include it with {implementation}.' },
    ],
  },
  {
    version: '1.4.0',
    date: '2026-10-14',
    title: 'Safer updates and one-click restore',
    items: [
      { kind: 'new', text: 'Before a new version opens your data for the first time, FieldLogger copies all of it aside, so an update can always be undone.' },
      { kind: 'new', text: 'Restore a backup in Settings → Data & backup: pick a daily copy, the copy from before your last save, or the one from before an update. Your current data is kept as a copy first.' },
      { kind: 'new', text: 'If a profile’s data file ever can’t be read, FieldLogger stops and offers to restore a backup instead of opening an empty profile. The unreadable file is kept aside.' },
      { kind: 'improved', text: 'Every save keeps the version it replaced, and data saved by a newer version opens read-only in an older one so it can’t be overwritten.' },
    ],
  },
  {
    version: '1.3.0',
    date: '2026-10-14',
    title: 'Implementations and milestones',
    items: [
      { kind: 'new', text: 'Mark which products a client is implementing: Estimate, Track, Schedule, Maintain and Field Employee. Pick as many as you need, and add more later from the client page.' },
      { kind: 'new', text: 'Each implementation has its plan milestones as a checklist. Ticking one records the date.' },
      { kind: 'new', text: 'Mark an implementation complete (and reopen it if needed). Client cards show each implementation’s progress.' },
      { kind: 'improved', text: 'Implementations replace the old single phase stepper.' },
      { kind: 'new', text: 'Customer code for each client (like WARD). It shows next to the name on the client page, is searchable, copies in one click, and can go in your notes with {code}.' },
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
      { kind: 'new', text: 'Notes: copy-ready lines for each entry, grouped by client, with check-off as you paste.' },
      { kind: 'new', text: 'Clients with phases, contacts, notes, logos and a one-click engagement link.' },
      { kind: 'new', text: 'Profiles with optional PINs and profile pictures, plus daily backups.' },
      { kind: 'new', text: 'Trimble and B2W brand palettes, accent colors and a Trimble Gray dark mode.' },
      { kind: 'fixed', text: 'Profiles whose data exists but went missing from the profile list are recovered automatically.' },
    ],
  },
];

export const LATEST_VERSION = CHANGELOG[0].version;
