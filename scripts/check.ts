import { spawn, spawnSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import {
  backendReports,
  lastStep,
  readJUnit,
  readNodeTest,
  readPlaywright,
  readVitest,
  tail,
  took,
} from './lib/checks.ts';
import { counted, keepRun, npmScripts, scriptsRunBy } from './lib/record.ts';
import { slowestFiles, specTimes, vitestDuration } from './lib/record.ts';
import type { KeptPart, Took, Why } from './lib/record.ts';

const HELP = `
check - every check in the repository, one part after another, and what each said

  node check.ts [--only backend,frontend,scripts,e2e] [--record [--why <why>]] [--root <tree>]
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
  --record         keep how long each part and each of its steps took, how many tests each ran and
                   where their time went, as a line of docs/experiments/performance/tests.jsonl. So
                   that every test really runs, the backend is compiled first, timed apart, and its
                   tests are run again whether or not they need to; the frontend's check is run a
                   step at a time. See decision record 0106.
  --why <why>      with --record, why it was measured: to-main, history, or by-hand (the default).
  --root <tree>    the tree to check: another worktree, or a checkout of an old commit. A part the
                   tree does not have is said and passed over. The logs and the line kept are this
                   tree's.
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
    record: { type: 'boolean', default: false },
    why: { type: 'string', default: 'by-hand' },
    root: { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

/** This tree, whose logs and history the run writes to; and the tree it checks, this one unless told another. */
const here = resolve(import.meta.dirname, '..');
const root = values.root === undefined ? here : resolve(values.root);
const record = values.record;
const windows = process.platform === 'win32';
const frontendTools = join(root, 'frontend', 'node_modules');
const logs = join(here, '.logs');
/** Vitest's JSON report, which a recorded run asks for beside its summary, for how long each test file took. */
const vitestReport = join(logs, 'check-frontend-vitest.json').replaceAll('\\', '/');

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
  /** Why the tree checked has no such part, an old commit's, or nothing. */
  readonly absent?: () => string | null;
  /**
   * What ran, in a few words, from its log: everything, or the step it stopped at when it did not pass. `since`
   * is when the part began, for what it reads besides its log.
   */
  readonly said: (log: string, stoppedAt: string | null, since: number) => string;
  /** What failed, by name, from its log or from what it wrote since it began. */
  readonly failures: (log: string, since: number) => readonly string[];
  /** For --record: its tests counted, and where their time went. */
  readonly kept: (log: string, since: number) => Omit<KeptPart, 'name' | 'passed' | 'ms' | 'steps'>;
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
    // Recorded, everything is compiled first so the check's time is its tests', and the tests run whether or not
    // anything they test changed: Gradle would otherwise keep a module's last results, and its time with them.
    steps: record
      ? [gradle('compile', 'testClasses'), gradle('check', 'cleanTest', 'check')]
      : [gradle('check', 'check')],
    // By its settings, not its folder: a newer commit's build output can be left in the folder of an older one.
    absent: () =>
      existsSync(join(root, 'backend', 'settings.gradle.kts')) ? null : 'no backend in this tree',
    said: (_, stoppedAt, since) => {
      const tally = readJUnit(
        backendReports(root, stoppedAt === null ? 0 : since).map((report) => report.xml),
      );
      const skipped =
        tally.skipped === 0
          ? ''
          : `, ${tally.skipped} skipped${dockerRuns() ? '' : ' because Docker is not running'}`;
      return `${tally.tests} tests${tally.failed === 0 ? '' : `, ${tally.failed} failed`}${skipped}`;
    },
    failures: (_, since) => readJUnit(backendReports(root, since).map((report) => report.xml)).failures,
    kept: (_, since) => {
      const reports = backendReports(root, since);
      return { ...counted(readJUnit(reports.map((report) => report.xml))), ...specTimes(reports) };
    },
  },
  {
    name: 'frontend',
    steps: npmSteps(join(root, 'frontend'), 'check'),
    absent: () => (existsSync(join(root, 'frontend', 'package.json')) ? null : 'no frontend in this tree'),
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
        : `stopped at ${stoppedAt === 'check' ? (lastStep(log) ?? 'its first step') : stoppedAt}${tests}`;
    },
    failures: (log) => readVitest(log)?.failures ?? [],
    kept: (log) => ({
      ...counted(readVitest(log)),
      ...(vitestDuration(log) === null ? {} : { vitest: vitestDuration(log)! }),
      slowest: existsSync(vitestReport)
        ? slowestFiles(readFileSync(vitestReport, 'utf8'), join(root, 'frontend'))
        : [],
    }),
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
    absent: () => (existsSync(join(root, 'scripts', 'test')) ? null : 'no tests of its own in this tree'),
    said: (log, stoppedAt) => {
      const tally = readNodeTest(log);
      const tests =
        tally === null
          ? 'its tests'
          : `${tally.tests} tests${tally.failed > 0 ? `, ${tally.failed} failed` : ''}`;
      return stoppedAt === null ? `${tests}, types and format` : `stopped at its ${stoppedAt}; ${tests}`;
    },
    failures: (log) => readNodeTest(log)?.failures ?? [],
    kept: (log) => counted(readNodeTest(log)),
  },
  {
    name: 'e2e',
    steps: [{ what: 'e2e', command: 'npm', args: ['run', 'e2e'], cwd: join(root, 'frontend') }],
    missing: () => {
      if (!existsSync(frontendTools)) return 'npm install --prefix frontend, once, from the repository root';
      if (!worldCut()) return "this tree's world cut, which the quick start does: debug-quick-start.ps1";
      return null;
    },
    absent: () =>
      npmScripts(join(root, 'frontend'))['e2e'] === undefined ? 'no end-to-end test in this tree' : null,
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
    kept: (log) => counted(readPlaywright(log)),
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

  const why = values.why as Why;
  if (!['to-main', 'history', 'by-hand'].includes(why)) {
    console.error(`--why is to-main, history or by-hand, not ${why}`);
    return 1;
  }
  mkdirSync(logs, { recursive: true });
  console.log(
    `\nEvery check in ${root === here ? 'the repository' : root}, one part after another${record ? ', recorded' : ''}.\n`,
  );

  const started = Date.now();
  const failed: string[] = [];
  const kept: KeptPart[] = [];
  const notRun = (part: Part, why: string) =>
    kept.push({ name: part.name, passed: false, notRun: why, ms: 0, steps: [], ...counted(null) });
  for (const part of PARTS.filter((p) => chosen.includes(p.name))) {
    process.stdout.write(`  ${part.name.padEnd(10)} `);
    const absent = part.absent?.();
    if (absent) {
      console.log(`not in this tree: ${absent}`);
      notRun(part, absent);
      continue;
    }
    const missing = part.missing?.();
    if (missing) {
      console.log(`not run: it needs ${missing}`);
      failed.push(part.name);
      notRun(part, `it needs ${missing}`);
      continue;
    }
    const log = join(logs, `check-${part.name}.log`);
    if (record) rmSync(vitestReport, { force: true });
    const began = Date.now();
    const { stoppedAt, steps } = await runAll(part.steps, log);
    const passed = stoppedAt === null;
    const said = readFileSync(log, 'utf8');
    if (record) {
      const ms = Date.now() - began;
      kept.push({ name: part.name, passed, ms, steps, ...part.kept(said, began) });
    }
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
  if (record) console.log(keepRun(here, root, why, Date.now() - started, kept, dockerRuns()));
  return failed.length === 0 ? 0 : 1;
}

/**
 * Runs a part's steps one after another into its log, and answers with the first that fails, or null, and how long
 * each that ran took.
 */
async function runAll(
  steps: readonly Step[],
  log: string,
): Promise<{ stoppedAt: string | null; steps: Took[] }> {
  const out = openSync(log, 'w');
  const ran: Took[] = [];
  let stoppedAt: string | null = null;
  try {
    for (const step of steps) {
      const began = Date.now();
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
      ran.push({ name: step.what, ms: Date.now() - began });
      // Recorded, every step runs, so that one that fails does not leave the rest untimed.
      if (code !== 0 && !record) return { stoppedAt: step.what, steps: ran };
      if (code !== 0) stoppedAt ??= step.what;
    }
    return { stoppedAt, steps: ran };
  } finally {
    closeSync(out);
  }
}

/** A step of the backend: Gradle's wrapper given tasks. */
function gradle(what: string, ...tasks: string[]): Step {
  // A .bat needs a shell to run it on Windows, and Gradle's wrapper is one. Named whole, because a shell told not
  // to look in the folder it is in for commands - NoDefaultCurrentDirectoryInExePath - finds no gradlew.bat.
  const command = windows ? `"${join(root, 'backend', 'gradlew.bat')}"` : './gradlew';
  return { what, command, args: [...tasks, '--console=plain'], cwd: join(root, 'backend') };
}

/**
 * An npm script as steps: whole; or, recorded, a script that only runs others one after another, `npm run a && npm
 * run b`, as a step each, so that each is timed, and Vitest asked for its JSON report too.
 */
function npmSteps(cwd: string, script: string): Step[] {
  const scripts = npmScripts(cwd);
  const named = scriptsRunBy(scripts[script] ?? '');
  if (!record || named === null) return [{ what: script, command: 'npm', args: ['run', script], cwd }];
  const json = ['--', '--reporter=default', '--reporter=json', `--outputFile.json=${vitestReport}`];
  const vitest = (name: string) => (scripts[name]?.startsWith('vitest') ? json : []);
  return named.map((name) => ({ what: name, command: 'npm', args: ['run', name, ...vitest(name)], cwd }));
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
    { encoding: 'utf8' },
  );
  return asked.status === 0 && asked.stdout.split(/\r?\n/).includes(service);
}

/** Whether Docker answers, which is whether the tests that need it ran. */
function dockerRuns(): boolean {
  return spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;
}
