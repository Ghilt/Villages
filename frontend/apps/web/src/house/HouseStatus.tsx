import { useEffect, useState, useSyncExternalStore } from 'react';

import { describeDay } from '@villages/protocol';
import type { ResourceName } from '@villages/protocol';
import { TICK_MS } from '@villages/client-core';

import { gatewayState, watchGateway } from '../net/gateway';
import type { Room } from '../stage/panes';
import { RESOURCES_IN_ORDER, RESOURCE_WORDS, blazon, saysStock } from './describe';
import { Mark } from '../marks/Mark';
import { PaneSizeControl } from '../stage/PaneSizeControl';
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

/*
 * The five resources are marks, because five words will not sit on one line of a phone. They are drawn in
 * `marks/Mark.tsx`, which a key figure's stats share, so the house's piety and a key figure's piety are
 * one drawing. What each one means is on its label, until it is learnt.
 */

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

/**
 * **House status**: how your own house stands, always to hand.
 *
 * Never opened and never closed, and always about yours - which is the line between it and an **inspect
 * window**, which is opened on a thing and can be about anybody's house. See `MECHANICS.md`.
 *
 * Three sizes, and the mechanic owns all three. **Full** is the card in the corner, cut off by it: two edges
 * are the stage's own and the card sits into them the way a paper sits under the edge of a desk, which is
 * what lets it be this size without reading as a panel laid over the map. **Small** is one line of it and
 * the bar, for when it is sharing a phone with something else. **Strip** is the name and no more, so the
 * player who put it away knows where it went.
 *
 * In the spread the corner is one size whichever of its tabs is up, and its normal size is this card's
 * whole height, so there small is the whole card and opened out is the whole card with room to spare. The
 * one-line form is a phone's. See decision record 0057.
 *
 * What it says is thin because a house is thin: a name, a banner, a seat and one resource. `MECHANICS.md`
 * says what it is waiting on, and it is mostly the resource system.
 *
 * Before there is a house it says so, because a player who has not founded one yet is the first thing this
 * has to handle: the frame is drawn either way, and the field inside it is empty.
 */
export function HouseStatus({ room }: { room: Room }) {
  const heard = useSyncExternalStore(watchGateway, gatewayState);
  const [now, setNow] = useState(() => Date.now());
  const yours = heard.yourHouse;
  const house = yours === null ? null : yours.house;

  useEffect(() => {
    if (house === null) {
      return;
    }
    const often = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(often);
  }, [house]);

  if (room.size === 'strip') {
    return (
      <div className="hud hud--strip">
        <section className="hud__panel hud__panel--strip">
          <span className="hud__name">{house === null ? 'No house yet' : house.name}</span>
          <PaneSizeControl room={room} />
        </section>
      </div>
    );
  }

  const small = room.size === 'small';
  const said = (name: ResourceName) => (yours === null ? '—' : saysStock(yours.resources[name], now));

  return (
    <div className={small ? 'hud hud--small' : 'hud'} aria-live="polite">
      <section className={house === null ? 'hud__panel hud__panel--vacant' : 'hud__panel'}>
        <PaneSizeControl room={room} />

        <div className="hud__achievement">
          <div className="hud__banner" aria-hidden="true">
            <svg viewBox="0 0 80 92" role="presentation">
              <path d={ACHIEVEMENT.scrollLeft} className="ornament" />
              <path d={ACHIEVEMENT.scrollRight} className="ornament" />
              <path d={ACHIEVEMENT.stem} className="ornament" />
              <circle cx="40" cy="89.6" r="2.4" className="ornament__stud" />
              <path d={ACHIEVEMENT.frame} className="hud__frame" />
              <path d={ACHIEVEMENT.rule} className="hud__rule" />
              <circle cx="12" cy="40" r="1.6" className="ornament__stud" />
              <circle cx="68" cy="40" r="1.6" className="ornament__stud" />
              <path d={ACHIEVEMENT.crest} className="ornament__stud" />
              <path
                d={ACHIEVEMENT.field}
                className={house === null ? 'hud__shield' : 'hud__shield hud__shield--borne'}
                style={house === null ? undefined : { fill: TINCTURE[house.banner.field] }}
              />
            </svg>
          </div>

          <div className="hud__house">
            <p className="hud__name">{house === null ? 'No house yet' : house.name}</p>
            {/* The line that goes first when the room runs out: it is the most words and the least news.
                Always written, and left out by the stylesheet where there is no room - the one-line form
                on a phone, a squeezed column - because the corner's normal size has room for it. */}
            <p className="hud__hint">
              {house === null
                ? 'The map is the world. Your seat is somewhere on it.'
                : `${blazon(house)}. Founded ${describeDay(house.since)}.`}
            </p>
            <ul className="hud__resources">
              {RESOURCES_IN_ORDER.map((name) => (
                <li className="hud__resource" key={name} title={RESOURCE_WORDS[name]}>
                  <Mark name={name} className="hud__mark" />
                  {/* The word is on the label rather than on the card: a mark nobody can read yet is
                      still a mark a screen reader has to say, and a tooltip is how the five are learnt. */}
                  <span aria-label={`${RESOURCE_WORDS[name]}: ${said(name)}`}>{said(name)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <HouseBar borne={house !== null} />
      </section>
    </div>
  );
}
