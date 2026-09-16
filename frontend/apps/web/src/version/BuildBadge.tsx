import { useEffect, useState } from 'react';

import { badgeText, readBuild } from './badge';
import type { BuildHere } from './badge';

/**
 * A line in the bottom right corner saying which build this window is.
 *
 * Deliberately the smallest thing on the screen. It is not part of the fiction and it will go when the
 * game has players, but while there are a dozen checkouts that all look alike it is the difference
 * between knowing and assuming.
 */
export function BuildBadge() {
  const [build, setBuild] = useState<BuildHere | null>(null);

  useEffect(() => {
    let live = true;
    // A built page has no dev server to ask; it falls back to the wire version alone, which it knows.
    fetch('/dev-api/build')
      .then((answer) => answer.json())
      .then((said: unknown) => {
        if (live) {
          setBuild(readBuild(said));
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  return <div className="build">{badgeText(build)}</div>;
}
