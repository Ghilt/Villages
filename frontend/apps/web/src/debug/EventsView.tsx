import { useSyncExternalStore } from 'react';
import type * as maplibregl from 'maplibre-gl';

import type { BannerSpec, EventFrame } from '@villages/protocol';

import { gateway, gatewayState, watchGateway } from '../net/gateway';
import { atToClock, note } from './log';

interface EventsViewProps {
  map: maplibregl.Map | null;
}

/** `villages.house.founded.v1` reads as `house founded`, which is what a line in a list should say. */
function saidPlainly(eventType: string): string {
  const [, aggregate, verb] = eventType.split('.');
  return `${aggregate ?? '?'} ${verb ?? eventType}`;
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

/**
 * The events, as the world stores them, one line each and any of them open. This is decision 0023 made
 * real: Adam watches the world happen here. The founding button is scaffolding for exactly that, a way to
 * make something happen and see it arrive.
 */
export function EventsView({ map }: EventsViewProps) {
  const state = useSyncExternalStore(watchGateway, gatewayState);

  const foundHere = () => {
    if (map === null) return;
    const centre = map.getCenter();
    const commandId = `c-${Date.now().toString(36)}`;
    note('command', `founding a house at ${centre.lat.toFixed(3)}, ${centre.lng.toFixed(3)} as ${commandId}`);
    gateway().send({
      type: 'command',
      commandId,
      command: {
        type: 'foundHouse',
        houseId: crypto.randomUUID(),
        name: `${pick(NAMES)} ${Math.floor(Math.random() * 90 + 10)}`,
        seat: { lat: centre.lat, lon: centre.lng },
        banner: randomBanner(),
      },
    });
  };

  return (
    <section className="events">
      <header className="events__bar">
        <span className="debug__title">Events</span>
        <span className={`events__link events__link--${state.connection}`}>{state.connection}</span>
        <button
          type="button"
          className="debug__button"
          onClick={foundHere}
          disabled={state.connection !== 'open'}
        >
          found a house here
        </button>
      </header>
      <ol className="events__list">
        {state.events.length === 0 && (
          <li className="debug__quiet">
            {state.connection === 'open'
              ? 'no events yet; found a house to see one'
              : 'not connected to the gateway'}
          </li>
        )}
        {[...state.events].reverse().map((event) => (
          <EventLine key={event.id} event={event} />
        ))}
      </ol>
    </section>
  );
}

function EventLine({ event }: { event: EventFrame }) {
  return (
    <li>
      <details className="events__event">
        <summary>
          <span className="debug__when">{atToClock(event.time)}</span>
          <span className="debug__area">{saidPlainly(event.eventType)}</span>
          <span className="events__stream">
            {event.stream.slice(0, 14)}… v{event.streamVersion}
          </span>
        </summary>
        <pre className="events__json">{JSON.stringify({ ...event, type: undefined }, null, 2)}</pre>
      </details>
    </li>
  );
}
