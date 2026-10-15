# FieldLogger: project context for Claude

FieldLogger is a local Windows desktop app (Electron) that Trimble B2W implementation
consultants use to log client actions (calls, emails, database populations, walkthroughs…)
on a calendar, then copy Kantata-ready note lines (`{time}: {event} - {notes}`) into Kantata.
Fully offline: no server, no accounts. The full build conversation is kept locally (not in git) at
`docs/build-conversation.md` on the original machine.

## Setup on a new machine

- No global Node needed. Get portable Node LTS into `.tools\node` (official zip from
  nodejs.org; verify SHA-256), or use any Node 22+ on PATH.
- PowerShell: `$env:Path = "$PWD\.tools\node;" + $env:Path`, then `npm install`.
  Electron downloads its binary lazily: run `node node_modules/electron/install.js` once.
- `npm start` runs the app; `npm run build` makes `dist\FieldLogger-Setup-<ver>.exe` (NSIS, per-user, unsigned).
- Releasing to the team: bump the version + changelog entry, `npm run build`, then `npm run publish-update`
  (copies the installer and writes `latest.json` with its SHA-256 and notes to the shared update folder:
  `fieldlogger.updateFolder` in package.json, or pass a folder). Installed apps check that folder at
  startup and every 4 hours and offer "Update now" (main.js `updates:*`: verifies the SHA-256, quits,
  runs the installer with `/S` and waits, then reopens `process.execPath`. Don't use the installer's
  `--force-run`: it opens the Start menu shortcut before it has been re-created).
- `.tools/`, `node_modules/`, `dist/`, `.snaps/` are gitignored.

## Architecture

- `main.js`: window (frameless, Windows title-bar overlay), all disk I/O, IPC handlers,
  profiles with scrypt-hashed PINs, atomic JSON writes, daily backups, orphan-profile recovery.
- `preload.js`: the only API the page gets (`window.fieldlogger`). Sandboxed, context-isolated.
- `src/`: Preact 11 + htm via ES modules, **no bundler**. Vendored libs live in `src/vendor`
  (`npm run vendor` regenerates them, including the Lucide icon subset listed in `scripts/vendor.js`).
- `src/lib/bridge.js` falls back to localStorage when not in Electron (`npm run preview` serves the UI in a browser).
- `src/lib/store.js` holds the single store, persistence (debounced save + sync save on close) and all mutations.
- Data lives in `%APPDATA%\FieldLogger\data\` (`profiles.json`, `profiles\<id>.json`, `backups\`).

## Conventions and decisions

- All colors derive from theme tokens and `--accent` (plus an optional exact `--accent-2` for brand palettes).
  Use `--accent-lift` for lines and dots and `--accent-text` for text, so dark brand colors stay readable.
- Brand palettes: Trimble (#0063a3/#004f83, Yellow #fbad26, Gray #252a2e dark mode) and B2W (#982017/#7a0b0a).
- Client logos and profile photos are resized locally (`src/lib/image.js`) and stored as data URLs.
- Sign-in: no PIN → reopen straight into the last profile; PIN → straight to that profile's PIN screen
  (`pinOnLaunch`). Lock keeps the last profile; Switch profile forgets it.
- Releases: every user-facing change bumps `version` in `package.json` (minor for features, patch for fixes)
  and adds a matching entry at the top of `src/lib/changelog.js`, which Settings → Update log displays.
- Data safety (don't weaken these): a data file that exists but can't be read is never replaced. `data:load`
  throws `FL_UNREADABLE`, saves to it are refused, and the sign-in screen offers `backups:restore`. Each save keeps
  `<id>-previous.json`; the first launch of a new version copies the data folder to `backups/pre-update-*` before
  anything reads it. Changing the saved data shape means bumping `DATA_VERSION` and adding a `MIGRATIONS` step in
  `src/lib/defaults.js`. Newer data opens read-only, and main refuses saves with an older data version.
- `signIn` registers the profile before writing data. `profiles:list` re-adopts unregistered data files as "Recovered profile".

## Verifying changes

- **Self-test** (real IPC + disk, scratch folder): set `FIELDLOGGER_SELFTEST=1` and
  `FIELDLOGGER_USER_DATA=<temp dir>`, then run electron or the packaged exe. It prints `SELFTEST PASS {...}`.
- **Screenshots**: `npx electron scripts/snap.js [shot names]` writes `.snaps/*.png` with sample data and temp storage.
- Rebuild the icon after editing `assets/logo.svg`: `npm run icon`.

## Open items

- Installer is unsigned (SmartScreen warning). GitHub Release publishing is pending `gh auth login`.
- One past case of a profile missing from `profiles.json`; root cause unknown, now auto-recovered.
