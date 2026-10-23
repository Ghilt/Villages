import type { Rarity } from '@villages/protocol';

import { sessionStore } from '../net/gateway';
import { useStore } from '../store/useStore';
import { Section } from './Section';
import { nextRarity } from './levers';

/** The odds the server rolls by, out of a hundred, as `ODDS` in the fate engine says them. */
const ODDS = 'common 70, uncommon 22, rare 7, legendary 1';

const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'legendary'];

/**
 * The choice roll, looked into: the last roll's omens, which the player sees too, where its die landed and how many
 * kilometres round it the map was read (0118), and what it drew from, which the player never does - the pools it
 * opened and every action that could have been dealt with its weight - and the one lever, the next roll's rarity.
 *
 * **The lever stands in for the world's luck, and for nothing a player does.** Take action is the player's, in the
 * pane; this only says what the next throw comes up, so a legendary can be seen without a few hundred rolls. See
 * decision records 0023 and 0083.
 */
export function ChoiceRollSection() {
  const connection = useStore(sessionStore, (state) => state.connection);
  const yourHouse = useStore(sessionStore, (state) => state.yourHouse);
  const omens = useStore(sessionStore, (state) => state.yourChoice?.omens ?? null);
  const landing = useStore(sessionStore, (state) => state.yourChoice?.landing ?? null);
  const circleKm = useStore(sessionStore, (state) => state.yourChoice?.circleKm ?? null);
  const drawn = useStore(sessionStore, (state) => state.rollDrawn);
  const off = connection !== 'open' || yourHouse === null;

  return (
    <Section
      name="Choice roll"
      reading={drawn === null ? undefined : <span className="debug__quiet">{drawn.rarity}</span>}
    >
      <div className="debug__levers">
        <span className="debug__quiet">next roll</span>
        {RARITIES.map((rarity) => (
          <button
            key={rarity}
            type="button"
            className="debug__button"
            disabled={off}
            title={
              off
                ? 'no house yet; found one in World first'
                : `the next roll is ${rarity}, whatever the throw`
            }
            onClick={() => nextRarity(rarity)}
          >
            {rarity}
          </button>
        ))}
        <button
          type="button"
          className="debug__button"
          disabled={off}
          title={`the throw again: ${ODDS}`}
          onClick={() => nextRarity(null)}
        >
          the throw
        </button>
      </div>
      <p className="debug__quiet">odds out of a hundred: {ODDS}</p>
      {landing !== null && (
        <p className="debug__quiet">
          landed at {landing.lat.toFixed(4)}, {landing.lon.toFixed(4)}
          {circleKm === null ? '' : `, the map read ${circleKm} km round it`}
        </p>
      )}
      {omens === null || omens.length === 0 ? (
        <p className="debug__quiet">no hand pending; the omens of a roll are shown while its hand is</p>
      ) : (
        <ul className="debug__stocks">
          {omens.map((omen) => (
            <li className="debug__stock" key={omen.key}>
              <span className="debug__stock-name">
                {omen.words}
                {omen.value === undefined ? '' : ` ${omen.value}`}
              </span>
              <span className="debug__stock-figure" title={omen.key}>
                {omen.kind}
              </span>
            </li>
          ))}
        </ul>
      )}
      {drawn !== null && (
        <>
          <p className="debug__quiet">
            last roll drew {drawn.rarity}
            {drawn.forced ? ", the lever's" : ', the throw'} from {drawn.opened.join(', ')}
          </p>
          <ul className="debug__stocks">
            {drawn.considered.map((one) => (
              <li className="debug__stock" key={one.action}>
                <span className="debug__stock-name">{one.action}</span>
                <span className="debug__stock-figure">weight {one.weight}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}
