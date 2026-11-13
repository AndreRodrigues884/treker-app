// The online Supabase project from the command line: link it, push the migrations, and compare it
// with the local database. The project ref comes from EXPO_PUBLIC_SUPABASE_URL in .env.production
// (https://<ref>.supabase.co), so it is written in one place only. See docs/deploy.md.
//
//   node scripts/supabase-online.js link|push|diff|auth-diff|auth-push|backup [extra CLI flags]
//
// The database password is never read here: the Supabase CLI asks for it when it needs it (or
// reads SUPABASE_DB_PASSWORD from the environment).
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const [command, ...extra] = process.argv.slice(2);

function projectRef() {
  if (process.env.SUPABASE_PROJECT_REF) return process.env.SUPABASE_PROJECT_REF;
  const file = path.join(root, '.env.production');
  if (!fs.existsSync(file)) {
    fail('Missing .env.production. Copy .env.production.example and fill in the project URL.');
  }
  const url = /^EXPO_PUBLIC_SUPABASE_URL=(.*)$/m.exec(fs.readFileSync(file, 'utf8'))?.[1]?.trim();
  const match = url && /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/.exec(url);
  if (!match || match[1] === 'your-project-ref') {
    fail(`EXPO_PUBLIC_SUPABASE_URL in .env.production is not a project URL (${url || 'empty'}).`);
  }
  return match[1];
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

// The Supabase CLI installed in this project (the `supabase` devDependency): its entry point is a
// Node script, so it runs with this same Node, without npx and without a shell.
function supabaseCli() {
  const manifest = require.resolve('supabase/package.json', { paths: [root] });
  const { bin } = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const entry = typeof bin === 'string' ? bin : bin.supabase;
  return path.join(path.dirname(manifest), entry);
}

// Runs the Supabase CLI of this project; stops at the first failure. No shell: each argument
// (including the extra flags given after `--`) reaches the CLI exactly as written, and nothing in
// them is interpreted by cmd.exe or sh.
function supabase(args) {
  console.log(`\n> supabase ${args.join(' ')}`);
  const result = spawnSync(process.execPath, [supabaseCli(), ...args], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.error) fail(`Could not run the Supabase CLI: ${result.error.message}`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// deploy/supabase/config.toml points at the sign-in template, but the CLI only reads files inside
// deploy/: copy the one in supabase/templates there, so it has a single source.
function copyAuthTemplates() {
  const from = path.join(root, 'supabase', 'templates');
  const to = path.join(root, 'deploy', 'supabase', 'templates');
  fs.mkdirSync(to, { recursive: true });
  for (const file of fs.readdirSync(from)) {
    fs.copyFileSync(path.join(from, file), path.join(to, file));
  }
}

switch (command) {
  case 'link':
    // Remembers the online project in supabase/.temp (not committed).
    supabase(['link', '--project-ref', projectRef(), ...extra]);
    break;
  case 'push':
    // --remote is required: without it the CLI v3 pushes to the LOCAL database. Only the
    // migrations go up, never seed.sql (development data).
    projectRef();
    supabase(['db', 'push', '--remote', ...extra]);
    break;
  case 'diff':
    // Read-only: which migrations each side has, then the schema differences between the local
    // database and the online one (empty when they match).
    projectRef();
    supabase(['migration', 'list', '--remote']);
    supabase([
      'db',
      'diff',
      '--from',
      'local',
      '--to',
      'remote',
      '--schema',
      'public,private',
      ...extra,
    ]);
    break;
  case 'auth-diff':
    // Read-only: what deploy/supabase/config.toml (the sign-in by code) would change online.
    copyAuthTemplates();
    supabase(['config', 'diff', '--workdir', 'deploy', `--remote=${projectRef()}`, ...extra]);
    break;
  case 'auth-push':
    // Pushes ONLY deploy/supabase/config.toml (never supabase/config.toml, which is the local
    // stack's). The CLI shows the diff and asks before writing.
    copyAuthTemplates();
    supabase(['config', 'push', '--workdir', 'deploy', `--remote=${projectRef()}`, ...extra]);
    break;
  case 'backup': {
    // Read-only: the roles, the schema and the data of the online database, in
    // backups/<date>/ (not committed: it holds personal data). The Free plan has no automatic
    // backups. To restore, see "Cópias de segurança" in docs/deploy.md.
    projectRef();
    const folder = path.join('backups', new Date().toISOString().slice(0, 10));
    fs.mkdirSync(path.join(root, folder), { recursive: true });
    const file = (name) => path.join(folder, name).split(path.sep).join('/');
    supabase(['db', 'dump', '--remote', '--role-only', '-f', file('roles.sql')]);
    supabase(['db', 'dump', '--remote', '-f', file('schema.sql')]);
    supabase(['db', 'dump', '--remote', '--data-only', '--use-copy', '-f', file('data.sql')]);
    console.log(`
Backup in ${folder}/. Keep a copy off this PC (encrypted): it has personal data.`);
    break;
  }
  default:
    fail(
      'Usage: node scripts/supabase-online.js link|push|diff|auth-diff|auth-push|backup [extra CLI flags]',
    );
}
