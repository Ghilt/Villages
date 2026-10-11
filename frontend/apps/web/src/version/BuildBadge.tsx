import { useEffect, useState } from 'react';

import { badgeText, readBuild } from './badge';
import type { BuildHere } from './badge';

/**
 * A line at the foot of the debug panel saying which build this window is, the branch whole, wrapping
 * if it must, and taken in one click to be copied.
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

  return (
    <div className="build">
      {build !== null && build.branch !== '' && (
        <span className="build__branch" title="click to select the whole name">
          {build.branch}
        </span>
      )}
      <span>{badgeText(build)}</span>
    </div>
  );
}
