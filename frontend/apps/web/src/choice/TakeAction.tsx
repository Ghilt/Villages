import { canAct, freeNow } from '@villages/client-core';
import type { Looking } from '@villages/client-core';
import type { OptionView } from '@villages/protocol';

import { RESOURCE_WORDS } from '../house/describe';
import { sessionStore, takeAction } from '../net/gateway';
import { PaneSizeControl } from '../stage/PaneSizeControl';
import type { Along, Room } from '../stage/panes';
import { openingOut } from '../stage/strip';
import { useStore } from '../store/useStore';
import { TextButton } from '../ui/button/Button';
import { expectHand, overOf } from './rolling';

/**
 * What a roll costs in wealth, as the page says it before pressing. The server's `ROLL_PRICE` is the price, and a
 * roll the house cannot pay is refused there whatever this says; this is only so the button can say why it is
 * greyed rather than be pressed to find out. A temporary number, Adam's, on both sides. See decision record 0083.
 */
export const ROLL_PRICE_WEALTH = 10;

/**
 * **Take action**: the choice roll at rest, which is the button that provokes one. Words and not a mark, Adam's
 * call. Greyed while the house cannot pay or a command of the player's is waiting on its answer, and saying which;
 * pressed, it sends `roll` with what the page is looking at, `looking` handed down from the root, and the hand
 * that comes back takes the pane over. Put away on a desktop it is a chip with no size control, the button and what
 * it costs, and a press anywhere else on it opens it out. See `MECHANICS.md`, the choice roll, and 0085.
 */
export function TakeAction({ room, along, looking }: { room: Room; along: Along; looking: () => Looking }) {
  const free = useStore(sessionStore, (state) => {
    const wealth = state.yourHouse?.resources.wealth;
    return wealth === undefined ? null : freeNow(wealth, Date.now());
  });
  const ready = useStore(sessionStore, canAct);

  const whyNot =
    free === null
      ? 'the house is not founded yet'
      : free < ROLL_PRICE_WEALTH
        ? `a roll costs ${ROLL_PRICE_WEALTH} wealth, and the house has ${free} free`
        : !ready
          ? 'waiting on an answer'
          : null;
  const price = `${ROLL_PRICE_WEALTH} ${RESOURCE_WORDS.wealth.toLowerCase()}`;

  const button = (
    <TextButton
      size={room.size === 'strip' ? 'small' : 'large'}
      disabled={whyNot !== null}
      onClick={() => {
        expectHand();
        takeAction(looking());
      }}
    >
      Take action
    </TextButton>
  );

  if (room.size === 'strip') {
    return (
      <section
        className={`choice choice--strip pane-strip${along === null ? ' choice--chip' : ''}`}
        title={whyNot ?? `costs ${price}`}
        onClick={along === null ? undefined : openingOut(() => room.ask('full'))}
      >
        {button}
        <span className="choice__aside">{whyNot ?? price}</span>
        {along !== null && <PaneSizeControl room={room} />}
      </section>
    );
  }

  return (
    <section className={`choice choice--idle${overOf(along)}`}>
      <header className="choice__head">
        <span className="choice__aside" />
        <PaneSizeControl room={room} />
      </header>
      <div className="choice__take">
        {button}
        <p className="choice__price">{whyNot ?? `costs ${price}`}</p>
      </div>
    </section>
  );
}

/** What taking a rolled option gives, in the player's words: +15 wealth, or the conversation it begins. */
export function gives(option: OptionView): string {
  const effect = option.effect;
  switch (effect.kind) {
    case 'grant':
      return `+${effect.amount} ${RESOURCE_WORDS[effect.resource].toLowerCase()}`;
    case 'spend':
      return `-${effect.amount} ${RESOURCE_WORDS[effect.resource].toLowerCase()}`;
    case 'foundAt':
      return `founds ${effect.name}`;
    case 'converse':
      return `a conversation: ${effect.title}`;
    case 'pledge':
      return `pledges ${effect.amount} ${RESOURCE_WORDS[effect.resource].toLowerCase()}`;
  }
}
