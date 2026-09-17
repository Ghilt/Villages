import { useEffect, useState, useSyncExternalStore } from 'react';

import { describeDay } from '@villages/protocol';
import type { HouseView } from '@villages/protocol';

import { gatewayState, watchGateway } from '../net/gateway';
import { HouseBar } from './HouseBar';

/**
 * The achievement, drawn in one viewBox so the ornament and the shield cannot drift apart.
 *
 * Three contours nested rather than one shield with a thick stroke: an outer frame, a rule inside it and
 * the field itself, which is the only one that takes the tincture. Around them the ornament proper, and
 * none of it carries meaning: the heraldry is the field and the charge, and this is the frame it hangs in.
 */
const ACHIEVEMENT = {
  frame: 'M12 10 H68 V52 C68 70 40 85 40 85 C40 85 12 70 12 52 Z',
  rule: 'M16 14 H64 V52 C64 67 40 80 40 80 C40 80 16 67 16 52 Z',
  field: 'M20 18 H60 V52 C60 64.5 40 75 40 75 C40 75 20 64.5 20 52 Z',
  /** A scroll springing from each top corner, outwards and up, the right one the left one mirrored. */
  scrollLeft: 'M12 14 C5 14 2 9 5 5 C7 2.3 11 3 11.5 6 C11.8 8 10 9 8.6 8.2',
  scrollRight: 'M68 14 C75 14 78 9 75 5 C73 2.3 69 3 68.5 6 C68.2 8 70 9 71.4 8.2',
  /** A lozenge on the top edge and a boss hanging under the point, so the frame ends deliberately. */
  crest: 'M40 5.5 L43.5 10 L40 14.5 L36.5 10 Z',
  stem: 'M40 85 V88',
} as const;

/** How often the treasury is redrawn. A resource is a rate, so a still number would be a lie. */
const TICK_MS = 250;

/** The tinctures as ink on parchment, the same muted set the map draws marks in. */
const TINCTURE: Record<string, string> = {
  or: '#d4a017',
  argent: '#e8e4d8',
  gules: '#b03a2e',
  azure: '#1f4e79',
  sable: '#2b2b2b',
  vert: '#2e6b4f',
  purpure: '#5b3a86',
};

/** A banner in the words a herald would use, until the banner itself is drawn in increment 1.12. */
function blazon(house: HouseView): string {
  return `${house.banner.field}, a ${house.banner.charge} ${house.banner.chargeTincture}`;
}

/** The treasury as it stands now: an amount, a speed, and the instant that was true. See 0006. */
function treasuryAt(house: HouseView, now: number): number {
  const seconds = Math.max(0, (now - house.treasury.asOf) / 1000);
  return Math.floor(house.treasury.amount + house.treasury.ratePerSecond * seconds);
}

/**
 * The player's own house, in the corner, wherever they are looking.
 *
 * It sits into the corner rather than floating near it: two edges are the window's own, and the card is
 * cut off by them the way a paper under the edge of a desk is. That is what lets it be this size without
 * reading as a panel laid over the map.
 *
 * Two parts: the achievement and the name above, and the bar of the house's own levers along the bottom.
 * The bar is part of the house rather than furniture floating over the map, because what it does is the
 * house's doing.
 *
 * Before there is a house it says so, because a player who has not founded one yet is the first thing
 * this has to handle: the frame is drawn either way, and the field inside it is empty.
 */
export function HudShell() {
  const heard = useSyncExternalStore(watchGateway, gatewayState);
  const [now, setNow] = useState(() => Date.now());
  const house = heard.yourHouse;

  useEffect(() => {
    if (house === null) {
      return;
    }
    const often = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(often);
  }, [house]);

  return (
    <div className="hud" aria-live="polite">
      <header className="hud__title">Villages</header>

      <section className={house === null ? 'hud__panel hud__panel--vacant' : 'hud__panel'}>
        <div className="hud__achievement">
          <div className="hud__banner" aria-hidden="true">
            <svg viewBox="0 0 80 92" role="presentation">
              <path d={ACHIEVEMENT.scrollLeft} className="hud__ornament" />
              <path d={ACHIEVEMENT.scrollRight} className="hud__ornament" />
              <path d={ACHIEVEMENT.stem} className="hud__ornament" />
              <circle cx="40" cy="89.6" r="2.4" className="hud__stud" />
              <path d={ACHIEVEMENT.frame} className="hud__frame" />
              <path d={ACHIEVEMENT.rule} className="hud__rule" />
              <circle cx="12" cy="40" r="1.6" className="hud__stud" />
              <circle cx="68" cy="40" r="1.6" className="hud__stud" />
              <path d={ACHIEVEMENT.crest} className="hud__stud" />
              <path
                d={ACHIEVEMENT.field}
                className={house === null ? 'hud__shield' : 'hud__shield hud__shield--borne'}
                style={house === null ? undefined : { fill: TINCTURE[house.banner.field] }}
              />
            </svg>
          </div>

          {house === null ? (
            <div className="hud__house">
              <p className="hud__name">No house yet</p>
              <p className="hud__hint">The map is the world. Your seat is somewhere on it.</p>
              <dl className="hud__resources">
                <dt>Treasury</dt>
                <dd>&mdash;</dd>
              </dl>
            </div>
          ) : (
            <div className="hud__house">
              <p className="hud__name">{house.name}</p>
              <p className="hud__hint">
                {blazon(house)}. Founded {describeDay(house.since)}.
              </p>
              <dl className="hud__resources">
                <dt>Treasury</dt>
                <dd>{treasuryAt(house, now).toLocaleString()}</dd>
              </dl>
            </div>
          )}
        </div>

        <HouseBar borne={house !== null} />
      </section>
    </div>
  );
}
