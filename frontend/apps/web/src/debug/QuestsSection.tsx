import { useState } from 'react';

import { sessionStore } from '../net/gateway';
import { Section } from './Section';
import { offerQuest } from './levers';
import { useShelfNames } from './shelfNames';
import { useStore } from '../store/useStore';

/**
 * Quests, on purpose: the one lever, which offers one.
 *
 * **It stands in for the world, and for nothing a player does.** Nothing in the world offers a house a quest yet, so
 * this offers one of the quests on the shelf, `world/catalogues/quests/`, by its name, which is all the page sends:
 * none of its words. The first is the abbot of the isle, which opens with a dialogue at the gate. Meeting its
 * objectives, collecting its reward and seeing how it ended are the player's, and what happens is said in the log
 * under `quests`. See decision records 0023, 0096 and 0097.
 */
export function QuestsSection() {
  const connection = useStore(sessionStore, (state) => state.connection);
  const yourHouse = useStore(sessionStore, (state) => state.yourHouse);
  const names = useShelfNames('quests');
  const [chosen, choose] = useState<string | null>(null);
  const name = chosen !== null && names.includes(chosen) ? chosen : (names[0] ?? null);
  const off = connection !== 'open' || yourHouse === null || name === null;

  const whyNot =
    connection !== 'open'
      ? 'not connected to the world'
      : yourHouse === null
        ? 'no house yet; found one in World first'
        : name === null
          ? 'no quest on the shelf, world/catalogues/quests/'
          : `offer the quest ${name}`;

  return (
    <Section name="Quests">
      <div className="debug__levers">
        <select
          className="debug-map__select"
          aria-label="Which quest"
          value={name ?? ''}
          onChange={(event) => choose(event.target.value)}
        >
          {names.map((one) => (
            <option key={one} value={one}>
              {one}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="debug__button"
          disabled={off}
          title={whyNot}
          onClick={() => name !== null && offerQuest(name, `the quest ${name}`)}
        >
          offer a quest
        </button>
      </div>
    </Section>
  );
}
