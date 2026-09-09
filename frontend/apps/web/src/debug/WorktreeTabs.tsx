import { useCallback, useEffect, useState } from 'react';

/**
 * Which worktree you are looking at, and what else is up.
 *
 * Several sessions work at once, each in its own worktree, each a whole copy of the world on its own
 * branch. They look identical on the screen, which is how you end up judging a change in the wrong one.
 * This says which is which, in the smallest thing that can: a strip of tabs, the one you are on marked,
 * the ones that are serving live, the rest dim. See decision record 0031.
 *
 * Development only, and it draws nothing at all when there is one tree, because then there is nothing
 * to tell apart.
 */

interface WorktreeOnDisk {
  name: string | null;
  path: string;
  branch: string | null;
  port: number;
  running: boolean;
  here: boolean;
}

/** What to call a tree on a tab. The main checkout has no directory name of its own. */
function label(tree: WorktreeOnDisk): string {
  return tree.name ?? 'main';
}

/**
 * The one you are on, then the ones that are up, then the rest.
 *
 * There are usually eight or nine of these and at most two are serving, so listing them in git's order
 * buries the two that can actually be clicked. Alphabetical within each group, so a tab does not move
 * about between refreshes for any reason other than a server starting or stopping.
 */
function inReadingOrder(trees: WorktreeOnDisk[]): WorktreeOnDisk[] {
  const rank = (tree: WorktreeOnDisk) => (tree.here ? 0 : tree.running ? 1 : 2);
  return [...trees].sort((a, b) => rank(a) - rank(b) || label(a).localeCompare(label(b)));
}

export function WorktreeTabs() {
  const [trees, setTrees] = useState<WorktreeOnDisk[]>([]);

  const refresh = useCallback(() => {
    fetch('/dev-api/worktrees')
      .then((answer) => (answer.ok ? answer.json() : Promise.reject(new Error(String(answer.status)))))
      .then((found: { worktrees: WorktreeOnDisk[] }) => setTrees(found.worktrees))
      .catch(() => setTrees([]));
  }, []);

  // On load, and whenever the window is given focus, which is what coming back from another tree looks
  // like. A poll would be the obvious thing and would ask git and eight sockets forever; focus is when
  // the answer can actually have changed for you.
  useEffect(() => {
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refresh]);

  if (trees.length < 2) {
    return null;
  }

  return (
    <nav className="trees" aria-label="worktrees">
      {inReadingOrder(trees).map((tree) => {
        const name = label(tree);
        const where = `${tree.branch ?? 'detached'} — ${tree.running ? `serving on ${tree.port}` : `not running (${tree.port})`}`;

        if (tree.here) {
          return (
            <span key={tree.path} className="trees__tab trees__tab--here" title={where}>
              {name}
            </span>
          );
        }

        // A tree that is not serving has nothing to open, so it is shown and not offered.
        return tree.running ? (
          <a
            key={tree.path}
            className="trees__tab"
            href={`http://localhost:${tree.port}/`}
            target="_blank"
            rel="noreferrer"
            title={where}
          >
            {name}
          </a>
        ) : (
          <span key={tree.path} className="trees__tab trees__tab--down" title={where}>
            {name}
          </span>
        );
      })}
    </nav>
  );
}
