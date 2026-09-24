import { useState } from 'react';

import { portraitUrl } from './portraits';

/**
 * **A portrait in its frame**: one upright three-by-four picture of a character, in the ornament's gold.
 *
 * One component for every place a face is shown - the key figures pane now, the inspect window and
 * dialogue later - so a portrait is framed the same way wherever it hangs. The frame is two contours, a
 * gold edge and a fainter rule inside it, which is how the house's achievement draws its shield rather
 * than with one thick line. See `LOOK-AND-FEEL.md`.
 *
 * **Somebody with no picture is still somebody.** A character with no portrait, or with one whose file
 * is not there or will not load, is drawn as a bust in soft ink - never as an empty frame, and never as
 * the browser's broken-image mark, which is the program talking rather than the world.
 */

/** The bust drawn when there is no likeness, in the frame's own three by four. */
const BUST = {
  head: 'M15 8.6 A5.6 5.6 0 1 1 14.99 8.6',
  shoulders: 'M3.5 40 C3.8 31.2 8.6 26 15 26 C21.4 26 26.2 31.2 26.5 40 Z',
} as const;

interface PortraitProps {
  /** The portrait's key, or nothing for somebody who has none. */
  portrait: string | undefined;
  /** Who it is, said to anyone reading the page rather than looking at it. */
  name: string;
}

export function Portrait({ portrait, name }: PortraitProps) {
  // The key that failed, rather than a flag, so that another portrait is given its own chance to load.
  const [failed, setFailed] = useState<string | null>(null);
  const likeness = portrait !== undefined && portrait !== failed;

  return (
    <span className="portrait">
      {likeness ? (
        <img
          className="portrait__picture"
          src={portraitUrl(portrait)}
          alt={name}
          draggable={false}
          onError={() => setFailed(portrait)}
        />
      ) : (
        <svg className="portrait__bust" viewBox="0 0 30 40" role="img" aria-label={name}>
          <path d={BUST.head} />
          <path d={BUST.shoulders} />
        </svg>
      )}
    </span>
  );
}
