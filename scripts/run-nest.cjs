// Root launcher for the NestJS API app.
//
// Runs Nest with cwd=apps/api (NOT the repo root). Spawning node directly
// avoids the `npm --prefix ... run ...` ENOWORKSPACES stderr noise that
// npm workspaces trigger under `npm run dev`.
//
// Usage: node scripts/run-nest.cjs <dev|build|start> [extra nest args...]
const { spawn } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const apiDir = path.join(root, 'apps', 'api');
const nestBin = path.join(root, 'node_modules', '@nestjs', 'cli', 'bin', 'nest.js');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/run-nest.cjs <command> [args...]');
  process.exit(1);
}

// Map the npm script names to Nest CLI invocations.
// `start:dev` → `start -w` (watch), `start` → `start`, `build` → `build`.
const command = args[0];
const restArgs = args.slice(1);
let nestArgs;
if (command === 'start:dev') {
  nestArgs = ['start', '-w', ...restArgs];
} else {
  nestArgs = [command, ...restArgs];
}

const child = spawn(process.execPath, [nestBin, ...nestArgs], {
  cwd: apiDir,
  stdio: 'inherit',
  windowsHide: false,
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});