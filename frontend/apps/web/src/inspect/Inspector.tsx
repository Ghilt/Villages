import { useEffect, useState, useSyncExternalStore } from 'react';

import { housesInView } from '@villages/client-core';
import { describeDay } from '@villages/protocol';
import type { HouseView } from '@villages/protocol';

import { gatewayState, watchGateway } from '../net/gateway';
import { select, selectionNow, watchSelection } from '../select/selection';

/** How often the treasury is redrawn. A resource is a rate, so a still number would be a lie. */
const TICK_MS = 250;

/** A banner in the words a herald would use, which is how the parchment says it too. */
function blazon(house: HouseView): string {
  return `under ${house.banner.field}, a ${house.banner.charge} ${house.banner.chargeTincture}`;
}

/** Where a seat is, to about a hundred metres, which is as precise as a place on this map means. */
function whereabouts(house: HouseView): string {
  const north = house.seat.lat >= 0 ? 'N' : 'S';
  const east = house.seat.lon >= 0 ? 'E' : 'W';
  return `${Math.abs(house.seat.lat).toFixed(3)}° ${north}, ${Math.abs(house.seat.lon).toFixed(3)}° ${east}`;
}

/**
 * The treasury as it stands now: a rate is an amount, a speed and the instant that was true, and the
 * client fills in the time between. See decision record 0006.
 */
function treasuryAt(house: HouseView, now: number): number {
  const seconds = Math.max(0, (now - house.treasury.asOf) / 1000);
  return Math.floor(house.treasury.amount + house.treasury.ratePerSecond * seconds);
}

/**
 * What is selected on the map, said in words, down the left-hand side.
 *
 * It reads from the map's own read model rather than keeping a copy, so a house that changes while it is
 * being looked at changes here. A house that leaves the cells being held says so rather than freezing:
 * the interface never shows something it can no longer see.
 */
export function Inspector() {
  const selected = useSyncExternalStore(watchSelection, selectionNow);
  const heard = useSyncExternalStore(watchGateway, gatewayState);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const often = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(often);
  }, []);

  if (selected === null) {
    return null;
  }

  const house =
    housesInView(heard.houses).find((candidate) => candidate.id === selected.id) ??
    (heard.yourHouse?.id === selected.id ? heard.yourHouse : undefined);

  if (house === undefined) {
    return (
      <section className="inspect">
        <header className="inspect__bar">
          <span className="inspect__kind">House</span>
          <button type="button" className="inspect__close" onClick={() => select(null)}>
            close
          </button>
        </header>
        <p className="inspect__gone">Out of view. Pan back to it, or pick something else.</p>
      </section>
    );
  }

  const yours = heard.yourHouse?.id === house.id;

  return (
    <section className="inspect" aria-live="polite">
      <header className="inspect__bar">
        <span className="inspect__kind">{yours ? 'Your house' : 'House'}</span>
        <button type="button" className="inspect__close" onClick={() => select(null)}>
          close
        </button>
      </header>

      <h2 className="inspect__name">{house.name}</h2>
      <p className="inspect__blazon">{blazon(house)}</p>

      <dl className="inspect__facts">
        <dt>Seat</dt>
        <dd>{whereabouts(house)}</dd>
        <dt>Founded</dt>
        <dd>{describeDay(house.since)}</dd>
        <dt>Treasury</dt>
        <dd className="inspect__ticking">{treasuryAt(house, now).toLocaleString()}</dd>
        <dt>Cell</dt>
        <dd>{house.cell}</dd>
      </dl>
    </section>
  );
}
