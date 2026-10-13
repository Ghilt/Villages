import { execSync, spawn, spawnSync } from 'node:child_process';
import { mkdirSync, openSync } from 'node:fs';
import { createConnection } from 'node:net';
import { join, resolve } from 'node:path';

import { worktreeHere } from '../apps/web/vite/worktreePort.ts';

/** The repository this test runs in, two above this folder. */
export const ROOT = resolve(import.meta.dirname, '..', '..');

const windows = process.platform === 'win32';

/**
 * The ports the test serves on: this tree's own, a thousand up, so that the tree's servers can go on running
 * beside it and no other tree's are touched. See decision record 0031.
 */
export function testPorts(): { web: number; game: number; tree: string | null } {
  const tree = worktreeHere(ROOT);
  return { web: tree.port + 1000, game: tree.gamePort + 1000, tree: tree.name };
}

/** The test's own world in MongoDB, named so that `drop-gone-worlds` clears it should a run leave it behind. */
export function testDatabase(tree: string | null): string {
  return `villages-e2e-${(tree ?? 'main').toLowerCase().replace(/[^a-z0-9-]/g, '-')}`.slice(0, 63);
}

/**
 * Whether a service of the stack in infra/ is up: `mongodb`, which is whether the test can keep its world and so
 * restart it, and `rabbitmq`, which is whether RabbitMQ can carry it.
 */
export function stackHas(service: 'mongodb' | 'rabbitmq'): boolean {
  const asked = spawnSync(
    'docker',
    ['compose', '-f', join(ROOT, 'infra', 'docker-compose.yml'), 'ps', '--status', 'running', '--services'],
    {
      encoding: 'utf8',
    },
  );
  return asked.status === 0 && asked.stdout.split(/\r?\n/).includes(service);
}

/**
 * Deletes the test's virtual host in RabbitMQ, which the game server made, named as its database is (decision record
 * 0094), through the management page the stack serves. One that is not there is already as it should be.
 */
export async function deleteVirtualHost(name: string): Promise<void> {
  await fetch(`http://localhost:15672/api/vhosts/${encodeURIComponent(name)}`, {
    method: 'DELETE',
    headers: { Authorization: `Basic ${Buffer.from('villages:villages').toString('base64')}` },
  }).catch(() => undefined);
}

/** Drops the test's world, through the mongosh in the stack's own container. */
export function dropDatabase(database: string): void {
  spawnSync('docker', [
    'compose',
    '-f',
    join(ROOT, 'infra', 'docker-compose.yml'),
    'exec',
    '-T',
    'mongodb',
    'mongosh',
    '--quiet',
    '--eval',
    `db.getSiblingDB('${database}').dropDatabase()`,
  ]);
}

/** Where the test's world is kept and whether RabbitMQ carries it, as the game server is told. */
export interface Keeping {
  readonly store: 'mongo' | 'memory';
  readonly broker: 'rabbit' | 'in-process';
  /** The database, and the virtual host the server names after it. */
  readonly database: string;
}

/**
 * Starts the game server on `port`, keeping its world as told, and resolves once it answers. Its output goes to
 * .logs/e2e-game.log. It is Gradle's bootRun, which builds what has changed first, so the first start can take
 * a minute.
 */
export async function startGame(port: number, { store, broker, database }: Keeping): Promise<void> {
  mkdirSync(join(ROOT, '.logs'), { recursive: true });
  const out = openSync(join(ROOT, '.logs', 'e2e-game.log'), 'a');
  const args = `--server.port=${port} --villages.store=${store} --villages.broker=${broker} --villages.mongo.database=${database}`;
  // Named whole: a shell told not to look in its own folder for commands finds no gradlew.bat otherwise.
  const gradlew = windows ? `"${join(ROOT, 'backend', 'gradlew.bat')}"` : './gradlew';
  spawn(`${gradlew} --console=plain :app:bootRun "--args=${args}"`, {
    cwd: join(ROOT, 'backend'),
    shell: true,
    stdio: ['ignore', out, out],
    detached: !windows,
  }).unref();
  await until(() => answers(port), 240_000, `the game server to answer on ${port}`);
}

/**
 * Stops whatever answers on `port`, and resolves once nothing does. By the port, because bootRun runs the server in
 * a process of Gradle's own that outlives the command that started it.
 */
export async function stopGame(port: number): Promise<void> {
  for (const pid of listeners(port)) {
    if (windows) spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    else spawnSync('kill', ['-9', String(pid)], { stdio: 'ignore' });
  }
  await until(async () => !(await answers(port)), 30_000, `the game server on ${port} to stop`);
}

/** The processes listening on a port. */
function listeners(port: number): number[] {
  const said = windows
    ? execSync('netstat -ano -p TCP', { encoding: 'utf8' })
        .split(/\r?\n/)
        .filter((line) => line.includes('LISTENING') && new RegExp(`:${port}\\s`).test(line))
        .map((line) => Number(line.trim().split(/\s+/).pop()))
    : spawnSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' })
        .stdout.split(/\s+/)
        .filter(Boolean)
        .map(Number);
  return [...new Set(said.filter((pid) => pid > 0))];
}

/** Whether something accepts a connection on a port of this machine. */
export function answers(port: number): Promise<boolean> {
  return new Promise((done) => {
    const socket = createConnection({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      done(true);
    });
    socket.once('error', () => done(false));
  });
}

async function until(ready: () => Promise<boolean>, ms: number, what: string): Promise<void> {
  const giveUp = Date.now() + ms;
  while (!(await ready())) {
    if (Date.now() > giveUp) throw new Error(`gave up waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 500));
  }
}
