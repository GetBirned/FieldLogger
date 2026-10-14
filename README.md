# FieldLogger

**Log it in the field. Paste it into Kantata.**

FieldLogger is a local desktop app for implementation consultants. Log each
call, email, database population or walkthrough with one click, see it on a
calendar, and get copy-ready Kantata note lines for every entry:

```
2:15 PM: Phone Call - Walked Jamie through the cost code import
10:00-11:30 AM: Template Walkthrough - Bid item templates with estimators
```

Everything stays on your computer. There's no server, no cloud and no sign-up.

## Install (for colleagues)

1. Run `FieldLogger-Setup-1.0.0.exe`.
2. Windows may show **"Windows protected your PC"** because the app isn't
   code-signed. Click **More info → Run anyway**.
3. Pick an install folder (no admin rights needed). A **FieldLogger** shortcut
   is added to your desktop and Start menu.
4. Create your profile. You just need a name; a PIN is optional.

## Using it

| Do this | How |
| --- | --- |
| Log something you just did | **Log Action** (Ctrl+L), pick the action and client, then **Log it**. It's time-stamped now. |
| Log a past time range (2-3 PM) | Choose **Time range** in Log Action, or click and drag on the calendar |
| Time a call while it happens | Choose **Start timer**. It runs in the top bar; hit stop when you're done |
| One-click logging | **Quick log** buttons in the calendar side panel |
| Copy notes into Kantata | **Kantata Notes**: copy one line, a whole project, or the whole day |
| Track what's been entered | Tick the checkbox per line, or leave **Check off on copy** on |
| Clients, POCs, notes | **Clients**: add contacts (star one as POC), set the phase, write notes, mark active/inactive |
| Client logos | Click (or drop an image on) the client's tile, or paste one with Ctrl+V in Edit client. The logo then shows in Log Action, on the calendar and in Kantata Notes |
| Engagement link | Paste the client's Kantata / Salesforce DX engagement URL in **Edit client** to get an **Open engagement** button on the client page and in Kantata Notes |
| Profile picture | **Settings → Profile & PIN**: click, drop or paste a photo |
| Staying signed in | FieldLogger reopens straight into your profile. With a PIN, it asks for the PIN on launch (turn that off in Settings). **Lock** keeps your profile selected; **Switch profile** returns to the picker |
| Make it yours | **Settings → Appearance** for light/dark/system mode, 12 accent colors or a custom one, the aurora glow and density |
| Change the note format | **Settings → Kantata notes**. Tokens: `{time} {event} {notes} {client} {project} {duration} {hours} {date}` |

Shortcuts: `Ctrl+L` log · `Ctrl+1-4` switch pages · `T` today · `←/→` move · `D/W/M` day/week/month · `Esc` close · `Ctrl+Enter` save.

## Where data lives

`%APPDATA%\FieldLogger\data\`

- `profiles.json`: the list of local profiles (PINs are stored hashed)
- `profiles\<id>.json`: one file per profile with clients, entries and settings
- `backups\`: an automatic daily snapshot of each profile (last 14 days), plus any deleted profiles

Use **Settings → Data & backup** to export or import a `.json` backup (for
example, when moving to a new laptop). The PIN is a lock screen, not
encryption, so don't store passwords in client notes.

## Developing

The project carries its own portable Node.js in `.tools\node` (not required for
colleagues). In PowerShell:

```powershell
$env:Path = "$PWD\.tools\node;" + $env:Path
npm install          # first time only
npm start            # run the app
npm run build        # build dist\FieldLogger-Setup-<version>.exe
```

| Path | What it is |
| --- | --- |
| `main.js` | Electron main process: window, file storage, backups, IPC |
| `preload.js` | The small API the UI is allowed to call |
| `src/app.js` | UI entry: theme engine, shortcuts, tooltips |
| `src/components/` | Calendar, Log Action, Clients, Kantata Notes, Settings, launch screen |
| `src/lib/` | Store, time math, note formatting, defaults, sample data |
| `src/vendor/` | Preact, htm, Lucide icons and fonts (refresh with `npm run vendor`) |
| `assets/` | `logo.svg` and the generated `icon.png`/`icon.ico` (`npm run icon`) |
| `scripts/` | Vendoring, icon rendering, screenshots (`npm run snap`), browser preview (`npm run preview`) |

**Renaming the app:** change `APP_NAME` in `src/lib/defaults.js` and
`productName` in `package.json`. The data folder is pinned separately
(`DATA_FOLDER` in `main.js`), so a rename never strands anyone's logs.

**End-to-end check:** set `FIELDLOGGER_SELFTEST=1` and
`FIELDLOGGER_USER_DATA` to a scratch folder, then run the app. It exercises
profile, PIN, save and load through the real file store, prints `SELFTEST PASS`
or `FAIL`, and quits.
