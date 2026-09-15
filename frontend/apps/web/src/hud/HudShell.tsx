import { useEffect, useState, useSyncExternalStore } from 'react';

import { describeDay } from '@villages/protocol';
import type { HouseView } from '@villages/protocol';

import { gatewayState, watchGateway } from '../net/gateway';

const SHIELD = 'M3 3 H37 V21 C37 31 20 39 20 39 C20 39 3 31 3 21 Z';

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
 * Quiet on purpose: a name, a field of colour standing in for a banner, and one ticker. The vision asks
 * for a small surface with a deep reading, and this is the small surface. Before there is a house it
 * says so, because a player who has not founded one yet is the first thing this has to handle.
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

      <section className="hud__panel">
        <div className="hud__banner" aria-hidden="true">
          <svg viewBox="0 0 40 42" role="presentation">
            <path
              d={SHIELD}
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
      </section>
    </div>
  );
}
