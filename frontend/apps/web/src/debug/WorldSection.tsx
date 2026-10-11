import type * as maplibregl from 'maplibre-gl';

import type { BannerSpec } from '@villages/protocol';

import { clampBoundsToWorld } from '../map/sheet';
import { sessionStore, restart, wipeWorld } from '../net/gateway';
import { seedHouses } from '../net/seed';
import { note } from '../log/log';
import { Section } from './Section';
import { seeEverything } from './seeEverything';
import { foundHouseHere } from './levers';
import { useStore } from '../store/useStore';

interface WorldSectionProps {
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
 * Starting over lives here too. Decision 0036 put `restart` and `wipe` beside `copy` and `reset`,
 * which was where the buttons happened to be rather than where they belong: both are about the world
 * or the player beginning again, and `copy` is about the log. Still no confirmation on either.
 *
 * The events themselves are read on their own page rather than here: a panel over the map is the wrong
 * shape for a log, and the game window no longer asks the gateway for them at all. See decision 0023.
 */
export function WorldSection({ map }: WorldSectionProps) {
  const connection = useStore(sessionStore, (state) => state.connection);
  const everything = useStore(sessionStore, (state) => state.seeAll);

  /** Founds this player's one house, here. Pressed twice, the second is refused: you have a house. */
  const foundHere = () => {
    if (map === null) return;
    const centre = map.getCenter();
    foundHouseHere({ lat: centre.lat, lon: centre.lng }, aName(), randomBanner());
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

  // Only the connection goes in the bar. A bar holds a status or a button or two; five of them at the
  // panel's width wrapped into a column of slivers, and the body is the place with room.
  const tools = <span className={`events__link events__link--${connection}`}>{connection}</span>;

  const levers = (
    <div className="debug__levers">
      <button type="button" className="debug__button" onClick={foundHere} disabled={connection !== 'open'}>
        found a house here
      </button>
      <button type="button" className="debug__button" onClick={seedHere} disabled={connection !== 'open'}>
        seed {SEED}
      </button>
      {/*
          Significance decides how far out a thing stays drawn, and a founding earns zoom 8, so pulling
          back empties the map because the gateway stopped sending. This sets that aside for this
          connection, which is the only way to look at a whole world at once. See 0038.
        */}
      <button
        type="button"
        className={everything ? 'debug__button debug__button--on' : 'debug__button'}
        onClick={() => seeEverything(!everything)}
        disabled={connection !== 'open'}
        aria-pressed={everything}
        title="show every house in the held cells, however slight, at any zoom"
      >
        {everything ? 'seeing everything' : 'see everything'}
      </button>
      {/* No confirmation on either: the log line is the record, and this panel is not a player's. 0036. */}
      <button
        type="button"
        className="debug__button"
        onClick={restart}
        title="forget this player and arrive as a new one"
      >
        restart
      </button>
      <button
        type="button"
        className="debug__button"
        onClick={wipeWorld}
        title="empty the world for everyone connected to it"
      >
        wipe
      </button>
    </div>
  );

  return (
    <Section name="World" tools={tools}>
      {levers}
      <p className="debug__quiet">
        Events are at <a href={INSPECT_EVENTS}>{INSPECT_EVENTS}</a>, every inspect view at{' '}
        <a href="/admin">/admin</a>
      </p>
    </Section>
  );
}
