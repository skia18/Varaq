import { spawn, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const detached = process.platform !== 'win32';
const root = process.cwd();
const backend = resolve(root, 'apps/varaq-backend');
const frontend = resolve(root, 'apps/varaq-frontend');
const vite = resolve(root, 'node_modules/vite/bin/vite.js');
const apiBinary = join(tmpdir(), `varaq-api-dev-${process.pid}`);

console.log('[dev] Building the Go API…');
const build = spawnSync('go', ['build', '-o', apiBinary, './cmd/api'], {
  cwd: backend,
  env: process.env,
  stdio: 'inherit',
});
if (build.status !== 0) {
  rmSync(apiBinary, { force: true });
  process.exit(build.status ?? 1);
}

const services = [
  ['api', apiBinary, [], backend],
  ['web', process.execPath, [vite], frontend],
];
const children = new Map();
let shutdownPromise;

function stopChild(child, signal) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  try {
    if (detached) process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error;
  }
}

function signalAll(signal) {
  for (const child of children.values()) stopChild(child, signal);
}

function waitForChildren(timeout) {
  const running = [...children.values()].filter(
    (child) => child.exitCode === null && child.signalCode === null,
  );
  if (running.length === 0) return Promise.resolve();
  return Promise.race([
    Promise.all(
      running.map(
        (child) =>
          new Promise((resolve) => {
            child.once('close', resolve);
          }),
      ),
    ),
    new Promise((resolve) => setTimeout(resolve, timeout)),
  ]);
}

function shutdown(signal = 'SIGTERM', exitCode = 0) {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    signalAll(signal);
    await waitForChildren(1500);
    signalAll('SIGKILL');
    await waitForChildren(500);
    rmSync(apiBinary, { force: true });
    process.exit(exitCode);
  })();
  return shutdownPromise;
}

for (const [name, command, args, cwd] of services) {
  const child = spawn(command, args, {
    cwd,
    detached,
    env: process.env,
    stdio: 'inherit',
  });
  children.set(name, child);

  child.on('error', (error) => {
    console.error(`[dev] Could not start ${name}:`, error.message);
    void shutdown('SIGTERM', 1);
  });

  child.on('exit', (code, signal) => {
    if (shutdownPromise) return;
    const reason = signal ? `signal ${signal}` : `code ${code ?? 1}`;
    console.error(`[dev] ${name} stopped with ${reason}; stopping the other service.`);
    void shutdown('SIGTERM', code ?? 1);
  });
}

process.once('SIGINT', () => {
  void shutdown('SIGTERM', 130);
});

process.once('SIGTERM', () => {
  void shutdown('SIGTERM', 143);
});
