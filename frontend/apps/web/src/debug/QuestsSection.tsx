import { sessionStore } from '../net/gateway';
import { Section } from './Section';
import { offerQuest } from './levers';
import { useStore } from '../store/useStore';

/** The server's sample, by the name it knows it by. The page sends the name and none of the words. */
const ABBOT = 'abbot';

/**
 * Quests, on purpose: the one lever, which offers one.
 *
 * **It stands in for the world, and for nothing a player does.** Nothing in the world offers a house a quest yet,
 * so this offers the server's sample, the abbot of the isle, which opens with a dialogue at the gate. Meeting its
 * objectives, collecting its reward and seeing how it ended are the player's, and what happens is said in the log
 * under `quests`. See decision records 0023 and 0096.
 */
export function QuestsSection() {
  const connection = useStore(sessionStore, (state) => state.connection);
  const yourHouse = useStore(sessionStore, (state) => state.yourHouse);
  const off = connection !== 'open' || yourHouse === null;

  const whyNot =
    connection !== 'open'
      ? 'not connected to the world'
      : yourHouse === null
        ? 'no house yet; found one in World first'
        : 'offer the abbot of the isle: a dialogue at the gate whose answer picks one of two roads';

  return (
    <Section name="Quests">
      <div className="debug__levers">
        <button
          type="button"
          className="debug__button"
          disabled={off}
          title={whyNot}
          onClick={() => offerQuest(ABBOT, 'the abbot of the isle')}
        >
          offer a quest
        </button>
      </div>
    </Section>
  );
}
