// Idempotently patches Next.js's get-registry helper so it uses the
// NPM_CONFIG_REGISTRY env var instead of shelling out to
// `npm config get registry`, which hard-fails with ENOWORKSPACES when cwd
// is inside an npm workspace (npm.exec rejects `npm config` in workspaces
// before reading any config, so the stderr noise cannot be suppressed by
// pre-setting the registry value).
//
// Runs as a postinstall hook of @educore/web and is safe to re-run:
// it skips files that are already patched or that no longer match the
// expected source (e.g. after a Next.js upgrade that fixed this upstream).
const fs = require('fs');
const path = require('path');

const TARGET = 'let registry = `https://registry.npmjs.org/`;';
const REPLACEMENT =
  'let registry = `https://registry.npmjs.org/`;\n' +
  '    const fromEnv = process.env.NPM_CONFIG_REGISTRY;\n' +
  '    if (fromEnv) registry = fromEnv.endsWith("/") ? fromEnv : `${fromEnv}/`;';

const files = [
  path.join(__dirname, '..', 'apps', 'web', 'node_modules', 'next', 'dist', 'lib', 'helpers', 'get-registry.js'),
  path.join(__dirname, '..', 'apps', 'web', 'node_modules', 'next', 'dist', 'esm', 'lib', 'helpers', 'get-registry.js'),
];

let patched = 0;
for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes('NPM_CONFIG_REGISTRY')) {
    patched++;
    continue;
  }
  if (!source.includes(TARGET)) continue;
  fs.writeFileSync(file, source.replace(TARGET, REPLACEMENT));
  patched++;
}

console.log(`[patch-next-registry] ${patched}/${files.length} get-registry variant(s) patched.`);
