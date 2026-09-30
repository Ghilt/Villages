import { useSyncExternalStore } from 'react';

import { fullName } from '../figures/describe';
import { gatewayState, offerDialogue, watchGateway } from '../net/gateway';
import { Section } from './Section';

/** The server's sample, by the name it knows it by. The page sends the name and none of the words. */
const LETTER = 'letter';

/** Where what was offered can be read whole, since nothing on this page shows a dialogue yet. */
const INSPECT_EVENTS = '/admin/inspect-events';

/**
 * Dialogues, on purpose.
 *
 * **Adam's lever, not a player's.** Nothing in the world offers a house a dialogue yet, so this is the one way
 * to make one happen: the server's sample, a letter from the coast, spoken by the house's first key figure and
 * a messenger, with one dialogue choice and one purse. The lever is a real command and goes the whole way
 * round, so the asking and the answer are lines of the log under `dialogues` and the dialogue itself is on
 * the event page. It is off, saying why, while there is nobody to speak it. See decision records 0023 and 0067.
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
          : `offer the letter from the coast, between ${fullName(first)} and a messenger: one dialogue choice, one purse`;

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
      <p className="debug__quiet">
        What was offered is at <a href={INSPECT_EVENTS}>{INSPECT_EVENTS}</a>
      </p>
    </Section>
  );
}
