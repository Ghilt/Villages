import { useSyncExternalStore } from 'react';
import type * as maplibregl from 'maplibre-gl';

import type { BannerSpec } from '@villages/protocol';

import { clampBoundsToWorld } from '../map/sheet';
import { gateway, gatewayState, watchGateway } from '../net/gateway';
import { seedHouses } from '../net/seed';
import { note, shortId } from './log';

interface EventsViewProps {
  map: maplibregl.Map | null;
}

const TINCTURES = {
  metal: ['or', 'argent'],
  colour: ['gules', 'azure', 'sable', 'vert', 'purpure'],
} as const;
const pick = <T,>(from: readonly T[]): T => from[Math.floor(Math.random() * from.length)]!;

/** A banner the rule of tincture allows, at random: a colour charge on a metal field or the reverse. */
function randomBanner(): BannerSpec {
  const metalField = Math.random() < 0.5;
  return {
    field: pick(metalField ? TINCTURES.metal : TINCTURES.colour),
    division: 'plain',
    charge: pick(['tower', 'stag', 'star'] as const),
    chargeTincture: pick(metalField ? TINCTURES.colour : TINCTURES.metal),
  };
}

const NAMES = ['Ravenscar', 'Hollin', 'Thornwick', 'Ashby', 'Greymere', 'Corvane', 'Ellerby', 'Marrow'];

/** How many the seeding button founds at once: enough to see a region fill, few enough to read the log. */
const SEED = 20;

/** Where the events are read: its own page, which watches the world without playing in it. */
const INSPECT_EVENTS = '/admin/inspect-events';

/** A name a house might have. The house's identity is the server's business; this is only what to call it. */
function aName(): string {
  return `${pick(NAMES)} ${Math.floor(Math.random() * 90 + 10)}`;
}

/**
 * The ways to make something happen on purpose, and whether the gateway is listening.
 *
 * The events themselves are read on their own page rather than here: a panel over the map is the wrong
 * shape for a log, and the game window no longer asks the gateway for them at all. See decision 0023.
 */
export function EventsView({ map }: EventsViewProps) {
  const state = useSyncExternalStore(watchGateway, gatewayState);

  /** Founds this player's one house, here. Pressed twice, the second is refused: you have a house. */
  const foundHere = () => {
    if (map === null) return;
    const centre = map.getCenter();
    // A UUID, because this id becomes the causation of the events the command writes. See 0035.
    const commandId = crypto.randomUUID();
    note(
      'command',
      `founding a house at ${centre.lat.toFixed(3)}, ${centre.lng.toFixed(3)} as ${shortId(commandId)}`,
    );
    gateway().send({
      type: 'command',
      commandId,
      command: {
        type: 'foundHouse',
        name: aName(),
        seat: { lat: centre.lat, lon: centre.lng },
        banner: randomBanner(),
      },
    });
  };

  /**
   * Scatters houses over the view, as that many other players: a player founds one house, so twenty
   * houses is twenty players. See net/seed.ts.
   */
  const seedHere = () => {
    if (map === null) return;
    // Pulled back far enough the view runs past the world, and a seat off the world is refused.
    const seen = map.getBounds();
    const bounds = clampBoundsToWorld({
      north: seen.getNorth(),
      south: seen.getSouth(),
      east: seen.getEast(),
      west: seen.getWest(),
    });
    note('seed', `founding ${SEED} houses across the view, as ${SEED} other players`);
    void seedHouses(
      Array.from({ length: SEED }, () => ({
        name: aName(),
        seat: {
          lat: bounds.south + Math.random() * (bounds.north - bounds.south),
          lon: bounds.west + Math.random() * (bounds.east - bounds.west),
        },
        banner: randomBanner(),
      })),
    ).then((taken) => note('seed', `${taken} of ${SEED} founded`));
  };

  return (
    <section className="events">
      <header className="events__bar">
        <span className="debug__title">World</span>
        <span className={`events__link events__link--${state.connection}`}>{state.connection}</span>
        <button
          type="button"
          className="debug__button"
          onClick={foundHere}
          disabled={state.connection !== 'open'}
        >
          found a house here
        </button>
        <button
          type="button"
          className="debug__button"
          onClick={seedHere}
          disabled={state.connection !== 'open'}
        >
          seed {SEED}
        </button>
      </header>
      <p className="debug__quiet">
        Events are at <a href={INSPECT_EVENTS}>{INSPECT_EVENTS}</a>
      </p>
    </section>
  );
}
