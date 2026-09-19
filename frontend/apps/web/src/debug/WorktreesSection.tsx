import { useCallback, useEffect, useState } from 'react';

import { Section } from './Section';

/**
 * Which worktree you are looking at, and what else is up.
 *
 * Several sessions work at once, each in its own worktree, each a whole copy of the world on its own
 * branch. They look identical on the screen, which is how you end up judging a change in the wrong one.
 * This says which is which: one tree a row, the one you are on marked, the ones that are serving live
 * and clickable, the rest dim. Its branch and its port are written out rather than left in a tooltip,
 * because which port answers is the thing you check when a tree is behaving oddly. See record 0031.
 *
 * It was a strip of tabs across the top until it became a section, which cut the names off at 9rem and
 * scrolled sideways; a section has the panel's whole width and no reason to.
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

export function WorktreesSection() {
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

  const serving = trees.filter((tree) => tree.running).length;

  return (
    <Section name="Worktrees" tools={<span className="debug__quiet">{serving} serving</span>}>
      <ul className="trees" aria-label="worktrees">
        {inReadingOrder(trees).map((tree) => {
          const name = label(tree);
          const branch = tree.branch ?? 'detached';
          const port = tree.running ? `serving on ${tree.port}` : `not running (${tree.port})`;

          const inside = (
            <>
              <span className="trees__name">{name}</span>
              <span className="trees__branch">{branch}</span>
              <span className="trees__port">{port}</span>
            </>
          );

          if (tree.here) {
            return (
              <li key={tree.path} className="trees__tree trees__tree--here">
                {inside}
              </li>
            );
          }

          // A tree that is not serving has nothing to open, so it is shown and not offered.
          return tree.running ? (
            <li key={tree.path} className="trees__tree">
              <a
                className="trees__open"
                href={`http://localhost:${tree.port}/`}
                target="_blank"
                rel="noreferrer"
              >
                {inside}
              </a>
            </li>
          ) : (
            <li key={tree.path} className="trees__tree trees__tree--down">
              {inside}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
