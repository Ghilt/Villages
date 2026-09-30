import { useSyncExternalStore } from 'react';

import type { DialogueView } from '@villages/protocol';

import { impactWords, requirementWords, standing } from '../dialogues/describe';
import { fullName } from '../figures/describe';
import { gatewayState, offerDialogue, showRequirements, watchGateway } from '../net/gateway';
import { Section } from './Section';

/** The server's sample, by the name it knows it by. The page sends the name and none of the words. */
const LETTER = 'letter';

/** Where what was offered can be read whole, since only this section shows a dialogue yet. */
const INSPECT_EVENTS = '/admin/inspect-events';

/**
 * Dialogues, on purpose.
 *
 * **Adam's levers, not a player's.** Nothing in the world offers a house a dialogue yet, so this is the one way
 * to make one happen: the server's sample, a letter from the coast, spoken by the house's first key figure and
 * a messenger. The lever is a real command and goes the whole way round, and what comes back is listed here as
 * the player may know it - where each dialogue stands, and a waiting dialogue choice's options with what each
 * shows it will do. The switch asks the gateway for the requirements too, for this window only, since a player
 * is never sent them. See decision records 0023 and 0067.
 */
export function DialoguesSection() {
  const heard = useSyncExternalStore(watchGateway, gatewayState);
  const first = heard.yourKeyFigures?.[0] ?? null;
  const dialogues = heard.yourDialogues;
  const shown = heard.requirementsShown;
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

      {/*
          Adam's switch for the requirements, in words, as the fog's is. Off at every load; on sends this window
          what a player is never sent. See decision record 0067.
        */}
      <button
        type="button"
        className={shown ? 'debug-map__switch debug-map__switch--on' : 'debug-map__switch'}
        onClick={() => showRequirements(!shown)}
        aria-pressed={shown}
        title="ask the gateway for every dialogue's requirements in this window, which a player is never sent"
      >
        {shown ? 'requirements: shown' : 'requirements: hidden'}
      </button>

      {dialogues !== null &&
        (dialogues.length === 0 ? (
          <p className="debug__quiet">no dialogues yet</p>
        ) : (
          <ol className="debug__dialogues">
            {dialogues.map((dialogue) => (
              <DialogueEntry key={dialogue.id} dialogue={dialogue} />
            ))}
          </ol>
        ))}

      <p className="debug__quiet">
        What was offered is at <a href={INSPECT_EVENTS}>{INSPECT_EVENTS}</a>
      </p>
    </Section>
  );
}

/** One dialogue as the player may know it: its title, where it stands, and what is waiting to be chosen. */
function DialogueEntry({ dialogue }: { dialogue: DialogueView }) {
  const requirements = dialogue.requirements;
  return (
    <li className="debug__dialogue">
      <span>{dialogue.title}</span>
      <span className="debug__quiet">{standing(dialogue)}</span>
      {dialogue.options.length > 0 && (
        <ul className="debug__dialogue-options">
          {dialogue.options.map((option) => {
            const shows = impactWords(option.revealImpact);
            return (
              <li key={option.id}>
                {option.words}
                {shows !== null && <span className="debug__quiet"> ({shows})</span>}
              </li>
            );
          })}
        </ul>
      )}
      {requirements !== undefined && (
        <span className="debug__quiet">
          requires{' '}
          {requirements.length === 0
            ? 'nothing'
            : requirements.map((one) => requirementWords(one, dialogue.speakers)).join(', ')}
        </span>
      )}
    </li>
  );
}
