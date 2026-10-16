import { useState } from 'react';

import { fullName } from '../figures/describe';
import { sessionStore } from '../net/gateway';
import { Section } from './Section';
import { offerDialogue } from './levers';
import { useShelfNames } from './shelfNames';
import { useStore } from '../store/useStore';

/**
 * Dialogues, on purpose: the one lever, which offers one.
 *
 * **It stands in for the world, and for nothing a player does.** Nothing in the world offers a house a dialogue yet,
 * so this offers one of the dialogues on the shelf, `world/catalogues/dialogues/`, by its name, which is all the page
 * sends: none of its words. One spoken by the house's key figure needs one, and is refused a house with none.
 * Reading it, answering it and seeing how it ended are the player's, in the dialogues pane, and what happens is said
 * in the log under `dialogues`. Adam's word, 2026-10-01: all the debug panel does for dialogues is offer one. See
 * decision records 0023, 0071 and 0097.
 */
export function DialoguesSection() {
  const connection = useStore(sessionStore, (state) => state.connection);
  const yourHouse = useStore(sessionStore, (state) => state.yourHouse);
  const first = useStore(sessionStore, (state) => state.yourKeyFigures?.[0] ?? null);
  const names = useShelfNames('dialogues');
  const [chosen, choose] = useState<string | null>(null);
  const name = chosen !== null && names.includes(chosen) ? chosen : (names[0] ?? null);
  const off = connection !== 'open' || yourHouse === null || name === null;

  const whyNot =
    connection !== 'open'
      ? 'not connected to the world'
      : yourHouse === null
        ? 'no house yet; found one in World first'
        : name === null
          ? 'no dialogue on the shelf, world/catalogues/dialogues/'
          : `offer ${name}${first === null ? '; one spoken by a key figure needs one, from Characters' : `, spoken by ${fullName(first)} where it is spoken by a key figure`}`;

  return (
    <Section name="Dialogues">
      <div className="debug__levers">
        <select
          className="debug-map__select"
          aria-label="Which dialogue"
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
          onClick={() => name !== null && offerDialogue(name, `the dialogue ${name}`)}
        >
          offer a dialogue
        </button>
      </div>
    </Section>
  );
}
