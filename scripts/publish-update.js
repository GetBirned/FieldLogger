// Publishes the built installer to the shared update folder so everyone's FieldLogger
// offers it. Run after `npm run build`:
//   npm run publish-update                 (uses "fieldlogger.updateFolder" in package.json)
//   npm run publish-update -- "D:\Shared\FieldLogger Updates"
// Copies FieldLogger-Setup-<version>.exe, then writes latest.json (version, file, SHA-256,
// release notes from src/lib/changelog.js). latest.json is written last, so nobody is
// offered an installer that is still copying.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const file = `FieldLogger-Setup-${version}.exe`;
const KEEP_INSTALLERS = 3;

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

async function main() {
  const folder = process.argv[2] || pkg.fieldlogger?.updateFolder;
  if (!folder) fail('No update folder. Pass one: npm run publish-update -- "<folder>", or set "fieldlogger.updateFolder" in package.json.');
  if (!fs.existsSync(folder)) fail(`The update folder doesn't exist: ${folder}`);

  const installer = ['dist', 'release'].map((d) => path.join(root, d, file)).find((p) => fs.existsSync(p));
  if (!installer) fail(`No ${file} in dist\\ or release\\. Run "npm run build" first.`);

  const { CHANGELOG } = await import(pathToFileURL(path.join(root, 'src', 'lib', 'changelog.js')).href);
  const entry = CHANGELOG.find((r) => r.version === version);
  if (!entry) fail(`src/lib/changelog.js has no entry for ${version}. Add one so coworkers see what changed.`);

  // Don't move anyone backwards.
  const latestFile = path.join(folder, 'latest.json');
  if (fs.existsSync(latestFile)) {
    const current = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
    const newer = (a, b) => { const x = a.split('.').map(Number); const y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
    if (current.version === version) console.log(`  Replacing the published ${version}.`);
    else if (!newer(version, current.version)) fail(`The folder already offers ${current.version}, which is newer than ${version}.`);
  }

  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(installer)).digest('hex');
  const tmpExe = path.join(folder, `${file}.partial`);
  fs.copyFileSync(installer, tmpExe);
  fs.renameSync(tmpExe, path.join(folder, file));

  const latest = { version, file, sha256, date: entry.date, notes: { title: entry.title, items: entry.items }, publishedAt: new Date().toISOString() };
  const tmpJson = `${latestFile}.partial`;
  fs.writeFileSync(tmpJson, JSON.stringify(latest, null, 2), 'utf8');
  fs.renameSync(tmpJson, latestFile);

  // Keep the last few installers so someone mid-download isn't cut off.
  const old = fs.readdirSync(folder).filter((f) => /^FieldLogger-Setup-\d+\.\d+\.\d+\.exe$/.test(f) && f !== file)
    .sort((a, b) => fs.statSync(path.join(folder, a)).mtimeMs - fs.statSync(path.join(folder, b)).mtimeMs);
  for (const f of old.slice(0, Math.max(0, old.length - (KEEP_INSTALLERS - 1)))) fs.unlinkSync(path.join(folder, f));

  console.log(`  Published FieldLogger ${version} to ${folder}`);
  console.log(`  Everyone's FieldLogger will offer it within a few hours, or right away from Settings → Updates → Check now.`);
}

main().catch((err) => fail(err.message));
