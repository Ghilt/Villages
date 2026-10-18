import './loadingScreen.css';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import { Container } from '../container/Container';
import { Meter } from '../meter/Meter';
import { TitlePlate } from '../plate/TitlePlate';

/** How long the screen takes to fade once it is lifted. */
export const FADE_MS = 700;

/**
 * The loading screen: what covers the game while it is made ready, and fades once it is. A container like
 * any other, named by its recipe, the size of whatever holds it - which is made `position: relative` - and
 * over everything in it. A title on its plate in the middle, a line under it, and a meter of how far along
 * the work is when there is a figure for it.
 *
 * Lifted, it fades and then is gone, taking no pointer from the moment it starts to; covered again, it is
 * there at once, because only going is worth watching. Its colour is drawn before its pictures have
 * arrived, so it covers from its first frame. See docs/UI-COMPONENTS.md.
 */
export function LoadingScreen({
  title,
  says,
  share,
  shareSaid,
  lifted = false,
  onGone,
}: {
  title: ReactNode;
  /** A line under the title. */
  says?: ReactNode;
  /** How far along the work is, nought to one, or nothing when there is no figure to show. */
  share?: number;
  /** The share in words, for a screen reader: 38 of 52 tiles. */
  shareSaid?: string;
  /** Whether it has been lifted: it fades, and is gone. */
  lifted?: boolean;
  /** Said once it has faded, every time it is lifted. */
  onGone?: () => void;
}) {
  const [gone, setGone] = useState(false);
  const told = useRef(onGone);
  told.current = onGone;

  useEffect(() => {
    if (!lifted) {
      return undefined;
    }
    const timer = globalThis.setTimeout(() => {
      setGone(true);
      told.current?.();
    }, FADE_MS);
    return () => {
      globalThis.clearTimeout(timer);
      setGone(false);
    };
  }, [lifted]);

  if (gone) {
    return null;
  }
  return (
    <div
      className={`ui-loading ui-root${lifted ? ' ui-loading--lifted' : ''}`}
      style={{ '--ui-loading-fade': `${FADE_MS}ms` } as CSSProperties}
      role="status"
      aria-busy={!lifted}
    >
      <Container recipe="screen.loading" fills>
        <div className="ui-loading__middle">
          <TitlePlate title={title} />
          {says !== undefined && <p className="ui-epigraph">{says}</p>}
          {share !== undefined && (
            <span className="ui-loading__meter">
              <Meter
                value={Math.round(Math.min(1, Math.max(0, share)) * 100)}
                label="loaded"
                {...(shareSaid === undefined ? {} : { valueText: shareSaid })}
              />
            </span>
          )}
        </div>
      </Container>
    </div>
  );
}
