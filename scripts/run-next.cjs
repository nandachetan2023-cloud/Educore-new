// Root launcher for the Next.js web app.
//
// Runs Next with cwd=apps/web (NOT the repo root). This matters because
// Next resolves postcss.config.js / tailwind content globs relative to the
// working directory — running from the repo root silently skips Tailwind and
// serves unstyled pages. Spawning node directly also avoids the
// `npm config get registry` ENOWORKSPACES stderr noise that `npm --prefix`
// triggers under npm workspaces.
//
// Usage: node scripts/run-next.cjs <dev|build|start> [extra next args...]
const { spawn } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const webDir = path.join(root, 'apps', 'web');
const nextBin = path.join(webDir, 'node_modules', 'next', 'dist', 'bin', 'next');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/run-next.cjs <dev|build|start> [args...]');
  process.exit(1);
}

const child = spawn(process.execPath, [nextBin, ...args], {
  cwd: webDir,
  stdio: 'inherit',
  windowsHide: false,
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
