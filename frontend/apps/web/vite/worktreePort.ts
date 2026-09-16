import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Which port a worktree's dev server answers on.
 *
 * Sessions work in worktrees and several run at once, so one fixed port meant one tree could serve at a
 * time and the rest were blind. A port per tree fixes that, and the question is only how it is chosen.
 *
 * It is chosen by hashing the directory's name, so it is the same port every time that tree is started
 * and it can be bookmarked, told to somebody, or written in a session file. The alternative, taking the
 * first free port, moves the address between runs and makes the tab bar the only way to find your own
 * server. See decision record 0031.
 *
 * Worktrees are short-lived, which is why nothing here is written down anywhere: no registry, no file
 * per tree, nothing to clean up when one is deleted. The name is the whole input, and `git worktree
 * list` is the whole source of truth.
 */

/** The main checkout keeps 5173, because it is in every document and in Adam's muscle memory. */
export const MAIN_PORT = 5173;

/** How many ports the worktrees share, above the main one. */
export const WORKTREE_PORTS = 500;

/** The main checkout's game server, which is in every document and every bookmark. */
export const MAIN_GAME_PORT = 8080;

/**
 * How far above a tree's web port its game server sits.
 *
 * A worktree's two ports are one number apart by three thousand, so knowing either gives the other:
 * 5548 serves the page and 8548 serves the world. That matters because the game port used to be 8080
 * for everybody, which meant one tree could run a backend and the rest either sat blind or quietly
 * talked to somebody else's world - a page from one branch putting events into another branch's store.
 * The launcher now takes a port it finds in the wrong hands, which turned that old sharing from a
 * nuisance into a fight. See decision records 0031 and 0037.
 */
export const GAME_PORT_ABOVE = 3000;

/** The port a tree's game server answers on. The main checkout keeps 8080. */
export function gamePortFor(worktree: string | null): number {
  return worktree === null ? MAIN_GAME_PORT : portFor(worktree) + GAME_PORT_ABOVE;
}

/**
 * The port a worktree serves on, from its directory name. The main checkout is `null`.
 *
 * FNV-1a, because it is four lines, needs no dependency, and gives the same answer on every machine and
 * every version of Node, which a port has to. `Math.imul` is what keeps the multiply at 32 bits.
 *
 * The avalanche afterwards is not decoration. FNV ends on a multiply, and the low bits of a product
 * depend only on the low bits of what went into it, which is precisely what taking a remainder reads.
 * Without it, a thousand names of the shape these have - a slug and a hex suffix - landed on 307 of the
 * 500 ports where a fair hash gives about 432, so trees would have collided far more often than the
 * range suggests. It is the same finisher `hash2` uses in the painterly module.
 */
export function portFor(worktree: string | null): number {
  if (worktree === null) {
    return MAIN_PORT;
  }
  let hash = 0x811c9dc5;
  for (let at = 0; at < worktree.length; at += 1) {
    hash ^= worktree.charCodeAt(at);
    hash = Math.imul(hash, 0x01000193);
  }
  hash = Math.imul(hash ^ (hash >>> 15), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  hash ^= hash >>> 16;
  return MAIN_PORT + 1 + ((hash >>> 0) % WORKTREE_PORTS);
}

export interface Worktree {
  /** The directory's own name, which is what the port comes from. Null for the main checkout. */
  name: string | null;
  path: string;
  /** The branch checked out there, short form, or null when it is detached. */
  branch: string | null;
  /** Where its dev server answers. */
  port: number;
  /** Where its game server answers, which is the port its page connects to unless told otherwise. */
  gamePort: number;
}

/**
 * Every worktree, from `git worktree list --porcelain`.
 *
 * Kept apart from the command that produces it so that it can be tested without a repository, which is
 * the half where the mistakes live: the porcelain format is records separated by blank lines, a detached
 * head has no `branch` line at all, and the main checkout has to be told apart from the rest.
 */
export function parseWorktrees(porcelain: string, commonDir: string): Worktree[] {
  const main = resolve(dirname(commonDir));
  const found: Worktree[] = [];

  for (const record of porcelain.split(/\r?\n\r?\n/)) {
    const path = /^worktree (.+)$/m.exec(record)?.[1]?.trim();
    if (path === undefined || path === '') {
      continue;
    }
    const at = resolve(path);
    const isMain = at === main;
    const branch = /^branch refs\/heads\/(.+)$/m.exec(record)?.[1]?.trim() ?? null;
    const name = isMain ? null : basename(at);
    found.push({ name, path: at, branch, port: portFor(name), gamePort: gamePortFor(name) });
  }

  return found;
}

/** Ask git, and let a failure be an empty answer: no repository is not a reason for no dev server. */
function git(root: string, ...args: string[]): string | null {
  try {
    return execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

/** Every worktree of the repository `root` is in, the main checkout first as git lists it. */
export function worktrees(root: string): Worktree[] {
  const porcelain = git(root, 'worktree', 'list', '--porcelain');
  const commonDir = git(root, 'rev-parse', '--path-format=absolute', '--git-common-dir');
  if (porcelain === null || commonDir === null) {
    return [];
  }
  return parseWorktrees(porcelain, commonDir.trim());
}

/**
 * Which worktree `root` itself is, so a tree can name itself and take its own port.
 *
 * Falls back to the main checkout when git says nothing, which keeps a tarball or a broken git from
 * stopping the dev server: 5173 is then exactly what it was before any of this.
 */
export function worktreeHere(root: string): Worktree {
  const at = resolve(root);
  // Longest path first, because the worktrees live inside the main checkout and both would match.
  const mine = [...worktrees(root)]
    .sort((a, b) => b.path.length - a.path.length)
    .find((tree) => at === tree.path || at.startsWith(tree.path + sep));
  return mine ?? { name: null, path: at, branch: null, port: MAIN_PORT, gamePort: MAIN_GAME_PORT };
}

/**
 * What the preview tooling reads to start a server: this tree's ports and this tree's paths.
 *
 * It is generated rather than committed because every field in it is per-checkout. The port is now, and
 * the backend's path always was - the committed copy named `E:\Code\Villages\backend` outright, so
 * in any worktree it started the main checkout's server and nobody noticed. The same reasoning as
 * `.sessions/`: a file whose right contents differ per tree cannot be one file in git. See 0031.
 */
export function launchConfig(root: string): string {
  const tree = worktreeHere(root);
  return `${JSON.stringify(
    {
      $comment: 'Generated by node frontend/apps/web/vite/worktreePort.ts --launch. Not committed.',
      version: '0.0.1',
      configurations: [
        {
          name: 'web',
          runtimeExecutable: 'npm',
          runtimeArgs: ['--prefix', 'frontend', 'run', 'dev'],
          port: tree.port,
        },
        {
          name: 'backend',
          runtimeExecutable: resolve(root, 'backend', 'gradlew.bat'),
          runtimeArgs: [
            '-p',
            resolve(root, 'backend'),
            ':app:bootRun',
            `--args=--server.port=${tree.gamePort}`,
          ],
          port: tree.gamePort,
        },
      ],
    },
    null,
    2,
  )}
`;
}

/**
 * Run directly - `node frontend/apps/web/vite/worktreePort.ts` - it prints this tree's dev server port
 * and nothing else, which is how `debug-quick-start.ps1` asks; `--game` prints the game server's
 * instead. With `--launch` it also writes `.claude/launch.json` for this tree. The launcher, the dev
 * server and the preview tooling have to agree on the address to the digit, and the only way to be sure
 * of that is for there to be one of these.
 */
const asked = process.argv[1];
if (asked !== undefined && resolve(asked) === resolve(fileURLToPath(import.meta.url))) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
  if (process.argv.includes('--launch')) {
    mkdirSync(resolve(root, '.claude'), { recursive: true });
    writeFileSync(resolve(root, '.claude', 'launch.json'), launchConfig(root));
  }
  const tree = worktreeHere(root);
  process.stdout.write(String(process.argv.includes('--game') ? tree.gamePort : tree.port));
}
