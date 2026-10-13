import { spawn, spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { lastStep, readJUnit, readNodeTest, readPlaywright, readVitest, tail, took } from './lib/checks.ts';

const HELP = `
check - every check in the repository, one part after another, and what each said

  node check.ts [--only backend,frontend,scripts,e2e]
  .\\check.ps1  or  ./check.sh, which run this

Unlike the other tools here it does its work given nothing, because checking everything is the
whole of it. Four parts, one after another, because two at once on a busy machine make tests
time out that pass alone:

  backend    ./gradlew check: every module's tests, the architecture rules, the size ceilings.
             The tests that need Docker are skipped when it is not running, and it says how many.
  frontend   npm run check: the typecheck, the linter, the formatter and the unit tests.
  scripts    this folder's own: node --test, its types, and its formatting.
  e2e        npm run e2e: the game end to end in Chrome - the map drawn, a house founded, another
             window seeing it, an action taken with Take action, and a restart of the game server
             that forgets nothing - on servers,
             a world and a virtual host of the test's own, the world carried by RabbitMQ. The
             restart is not tried when MongoDB is not up, nor RabbitMQ used when it is not. It
             needs this tree's world cut, which the quick start does.

  --only <parts>   the parts to run, by name, separated by commas. Default: all four.
  --help           this.

Each part's whole output is written to .logs/check-<part>.log at the repository's root, over the
last run's, and said there at the end. What it prints is one line a part - passed or failed, how
long it took, and what ran - and, for a part that failed, what failed and the last of its log.
It ends with 0 when everything passed and 1 when anything did not. About five minutes in all.

  node check.ts --only frontend
`;

const { values } = parseArgs({
  options: {
    only: { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

const root = resolve(import.meta.dirname, '..');
const windows = process.platform === 'win32';
const frontendTools = join(root, 'frontend', 'node_modules');

interface Step {
  /** What the step checks, as a failure names it: its tests, its types, its format. */
  readonly what: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
}

interface Part {
  readonly name: string;
  readonly steps: readonly Step[];
  /** What has to be done before the part can run at all, or nothing. */
  readonly missing?: () => string | null;
  /**
   * What ran, in a few words, from its log: everything, or the step it stopped at when it did not pass. `since`
   * is when the part began, for what it reads besides its log.
   */
  readonly said: (log: string, stoppedAt: string | null, since: number) => string;
  /** What failed, by name, from its log or from what it wrote since it began. */
  readonly failures: (log: string, since: number) => readonly string[];
}

const node = (what: string, cwd: string, ...args: string[]): Step => ({
  what,
  command: process.execPath,
  args,
  cwd,
});

const PARTS: readonly Part[] = [
  {
    name: 'backend',
    // A .bat needs a shell to run it on Windows, and Gradle's wrapper is one. Named whole, because a shell told
    // not to look in the folder it is in for commands - NoDefaultCurrentDirectoryInExePath - finds no gradlew.bat.
    steps: [
      {
        what: 'check',
        command: windows ? `"${join(root, 'backend', 'gradlew.bat')}"` : './gradlew',
        args: ['check', '--console=plain'],
        cwd: join(root, 'backend'),
      },
    ],
    said: (_, stoppedAt, since) => {
      const tally = readJUnit(backendReports(stoppedAt === null ? 0 : since));
      const skipped =
        tally.skipped === 0
          ? ''
          : `, ${tally.skipped} skipped${dockerRuns() ? '' : ' because Docker is not running'}`;
      return `${tally.tests} tests${tally.failed === 0 ? '' : `, ${tally.failed} failed`}${skipped}`;
    },
    failures: (_, since) => readJUnit(backendReports(since)).failures,
  },
  {
    name: 'frontend',
    steps: [{ what: 'check', command: 'npm', args: ['run', 'check'], cwd: join(root, 'frontend') }],
    missing: () =>
      existsSync(frontendTools) ? null : 'npm install --prefix frontend, once, from the repository root',
    said: (log, stoppedAt) => {
      const tally = readVitest(log);
      const tests =
        tally === null
          ? ''
          : ` and ${tally.tests} tests${tally.failed === 0 ? '' : `, ${tally.failed} failed`}`;
      return stoppedAt === null
        ? `typecheck, lint, format${tests}`
        : `stopped at ${lastStep(log) ?? 'its first step'}${tests}`;
    },
    failures: (log) => readVitest(log)?.failures ?? [],
  },
  {
    name: 'scripts',
    steps: [
      node('tests', join(root, 'scripts'), '--test'),
      node('types', join(root, 'scripts'), join(frontendTools, 'typescript', 'bin', 'tsc'), '-p', '.'),
      node(
        'format',
        join(root, 'scripts'),
        join(frontendTools, 'prettier', 'bin', 'prettier.cjs'),
        '--config',
        join(root, 'frontend', '.prettierrc.json'),
        '--check',
        '.',
      ),
    ],
    // The types and the formatting borrow the frontend's compiler and Prettier, which this folder does not install;
    // its own install is sharp, whose types the tools that write WebP are checked against.
    missing: () => {
      if (!existsSync(frontendTools)) return 'npm install --prefix frontend, once, from the repository root';
      if (!existsSync(join(root, 'scripts', 'node_modules', 'sharp')))
        return 'npm install, once, in scripts/';
      return null;
    },
    said: (log, stoppedAt) => {
      const tally = readNodeTest(log);
      const tests =
        tally === null
          ? 'its tests'
          : `${tally.tests} tests${tally.failed > 0 ? `, ${tally.failed} failed` : ''}`;
      return stoppedAt === null ? `${tests}, types and format` : `stopped at its ${stoppedAt}; ${tests}`;
    },
    failures: (log) => readNodeTest(log)?.failures ?? [],
  },
  {
    name: 'e2e',
    steps: [{ what: 'e2e', command: 'npm', args: ['run', 'e2e'], cwd: join(root, 'frontend') }],
    missing: () => {
      if (!existsSync(frontendTools)) return 'npm install --prefix frontend, once, from the repository root';
      if (!worldCut()) return "this tree's world cut, which the quick start does: debug-quick-start.ps1";
      return null;
    },
    said: (log) => {
      const tally = readPlaywright(log);
      const tests = tally === null ? 'its test' : `${tally.tests} test${tally.tests === 1 ? '' : 's'}`;
      const short = !stackHas('mongodb')
        ? ', the restart not tried because MongoDB is not up'
        : !stackHas('rabbitmq')
          ? ', not carried by RabbitMQ because it is not up'
          : '';
      return `${tests}${short}`;
    },
    failures: (log) => readPlaywright(log)?.failures ?? [],
  },
];

// The answer is the exit code, set rather than given to process.exit, which on Windows can abort Node with
// "Assertion failed ... async.c" while what it printed is still on its way out.
if (values.help) console.log(HELP);
else
  process.exitCode = await checkAll(
    values.only?.split(',').map((name) => name.trim()) ?? PARTS.map((p) => p.name),
  );

/** Runs the parts named, one after another, says what each said, and answers 0 when every one passed. */
async function checkAll(chosen: readonly string[]): Promise<number> {
  const unknown = chosen.filter((name) => !PARTS.some((p) => p.name === name));
  if (unknown.length > 0) {
    console.error(
      `there is no part called ${unknown.join(' or ')}; the parts are ${PARTS.map((p) => p.name).join(', ')}`,
    );
    return 1;
  }

  const logs = join(root, '.logs');
  mkdirSync(logs, { recursive: true });
  console.log('\nEvery check in the repository, one part after another.\n');

  const started = Date.now();
  const failed: string[] = [];
  for (const part of PARTS.filter((p) => chosen.includes(p.name))) {
    process.stdout.write(`  ${part.name.padEnd(10)} `);
    const missing = part.missing?.();
    if (missing) {
      console.log(`not run: it needs ${missing}`);
      failed.push(part.name);
      continue;
    }
    const log = join(logs, `check-${part.name}.log`);
    const began = Date.now();
    const stoppedAt = await runAll(part.steps, log);
    const passed = stoppedAt === null;
    const said = readFileSync(log, 'utf8');
    console.log(
      `${passed ? 'passed' : 'FAILED'}  ${took(Date.now() - began).padStart(6)}  ${part.said(said, stoppedAt, began)}`,
    );
    if (!passed) {
      failed.push(part.name);
      const failures = part.failures(said, began);
      for (const name of failures.slice(0, 15)) console.log(`             failed: ${name}`);
      if (failures.length > 15) console.log(`             and ${failures.length - 15} more`);
      console.log(`             the last of ${log}:`);
      for (const line of tail(said)) console.log(`               ${line}`);
    }
  }

  const all = took(Date.now() - started);
  const where = join(logs, 'check-<part>.log');
  console.log(
    failed.length === 0
      ? `\nEverything passed, in ${all}. The whole of each part is in ${where}.\n`
      : `\n${failed.join(' and ')} did not pass, in ${all}. The whole of each part is in ${where}.\n`,
  );
  return failed.length === 0 ? 0 : 1;
}

/** Runs a part's steps one after another into its log, and answers with the first that fails, or null. */
async function runAll(steps: readonly Step[], log: string): Promise<string | null> {
  const out = openSync(log, 'w');
  try {
    for (const step of steps) {
      const code = await new Promise<number>((done) => {
        // npm and Gradle's wrapper are scripts that only a shell runs on Windows; Node itself is not. A shell is
        // handed the command as one line, because none of these arguments has a space in it.
        const shell = windows && step.command !== process.execPath;
        const options = { cwd: step.cwd, stdio: ['ignore', out, out] as ['ignore', number, number] };
        const child = shell
          ? spawn([step.command, ...step.args].join(' '), { ...options, shell: true })
          : spawn(step.command, [...step.args], options);
        child.on('error', () => done(1));
        child.on('close', (status) => done(status ?? 1));
      });
      if (code !== 0) return step.what;
    }
    return null;
  } finally {
    closeSync(out);
  }
}

/**
 * Every module's test reports, as Gradle left them, written since `since`: everything when the check passed,
 * because a module whose tests did not need running keeps its last and they are still true; and only what this
 * run wrote when it failed, so that a build that broke before any test ran is not counted as the last one's.
 */
function backendReports(since: number): string[] {
  const backend = join(root, 'backend');
  return readdirSync(backend, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(backend, entry.name, 'build', 'test-results', 'test'))
    .filter(existsSync)
    .flatMap((folder) =>
      readdirSync(folder)
        .filter((file) => file.endsWith('.xml') && statSync(join(folder, file)).mtimeMs >= since)
        .map((file) => readFileSync(join(folder, file), 'utf8')),
    );
}

/** Whether any master of this tree has been cut into tiles, which the end-to-end test draws the map from. */
function worldCut(): boolean {
  const masters = join(root, 'frontend', 'apps', 'web', 'public', 'world', 'masters');
  return (
    existsSync(masters) && readdirSync(masters).some((master) => existsSync(join(masters, master, 'tiles')))
  );
}

/**
 * Whether a service of the stack in infra/ is up: MongoDB, which is whether the end-to-end test tried a restart, and
 * RabbitMQ, which is whether it carried the world.
 */
function stackHas(service: 'mongodb' | 'rabbitmq'): boolean {
  const asked = spawnSync(
    'docker',
    ['compose', '-f', join(root, 'infra', 'docker-compose.yml'), 'ps', '--status', 'running', '--services'],
    {
      encoding: 'utf8',
    },
  );
  return asked.status === 0 && asked.stdout.split(/\r?\n/).includes(service);
}

/** Whether Docker answers, which is whether the tests that need it ran. */
function dockerRuns(): boolean {
  return spawnSync('docker', ['info'], { stdio: 'ignore', shell: windows }).status === 0;
}
