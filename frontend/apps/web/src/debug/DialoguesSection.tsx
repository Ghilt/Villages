import { useSyncExternalStore } from 'react';

import { fullName } from '../figures/describe';
import { gatewayState, offerDialogue, watchGateway } from '../net/gateway';
import { Section } from './Section';

/** The server's sample, by the name it knows it by. The page sends the name and none of the words. */
const LETTER = 'letter';

/**
 * Dialogues, on purpose: the one lever, which offers one.
 *
 * **It stands in for the world, and for nothing a player does.** Nothing in the world offers a house a
 * dialogue yet, so this offers the server's sample, a letter from the coast, spoken by the house's first key
 * figure and a messenger. Reading it, answering it and seeing how it ended are the player's, in the
 * dialogues pane, and what happens is said in the log under `dialogues`. Adam's word, 2026-10-01: all the
 * debug panel does for dialogues is offer one. See decision records 0023 and 0067.
 */
export function DialoguesSection() {
  const heard = useSyncExternalStore(watchGateway, gatewayState);
  const first = heard.yourKeyFigures?.[0] ?? null;
  const off = heard.connection !== 'open' || heard.yourHouse === null || first === null;

  const whyNot =
    heard.connection !== 'open'
      ? 'not connected to the world'
      : heard.yourHouse === null
        ? 'no house yet; found one in World first'
        : first === null
          ? "the letter is spoken by the house's first key figure; add one in Characters first"
          : `offer the letter from the coast, between ${fullName(first)} and a messenger: three answers, each shown differently`;

  const offer = () => {
    if (first !== null) {
      offerDialogue(LETTER, `the letter from the coast, between ${fullName(first)} and a messenger`);
    }
  };

  return (
    <Section name="Dialogues">
      <div className="debug__levers">
        <button type="button" className="debug__button" disabled={off} title={whyNot} onClick={offer}>
          offer a dialogue
        </button>
      </div>
    </Section>
  );
}
