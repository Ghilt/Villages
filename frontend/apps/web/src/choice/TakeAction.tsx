import { useEffect, useRef, useState } from 'react';

import { canAct, freeNow } from '@villages/client-core';
import type { Looking } from '@villages/client-core';
import type { OptionView } from '@villages/protocol';

import { RESOURCE_WORDS } from '../house/describe';
import { useBalance } from '../net/balance';
import { sessionStore, takeAction } from '../net/gateway';
import { dieStore } from '../sprites/die/hand';
import type { Landing } from '../sprites/die/hand';
import { PaneSizeControl } from '../stage/PaneSizeControl';
import type { Along, Room } from '../stage/panes';
import { useStore } from '../store/useStore';
import { Podium } from '../ui/podium/Podium';
import { expectHand, overOf } from './rolling';

/** How long a die lies where it rested before its roll is sent, so the player sees where. */
const SEEN_MS = 500;

/**
 * **Take action**: the choice roll at rest, the die on its podium, over the words, Adam's call. A long press lifts
 * it onto the map, where it hangs under the pointer or above the finger with the landing circle round its shadow; let
 * go still, it drops by its shadow, and with a flick it is thrown; once it rests the roll is sent from where it landed, with what else the page is
 * looking at, `looking` handed down from the root, and the hand that comes back takes the pane over while the die lies
 * where it fell. Let go over its slot, it goes back and nothing is paid. Enter drops it at the middle of the view.
 * Greyed while the house cannot pay or a command of the player's is waiting on its answer, and saying which. Put away
 * on a desktop it is a chip with no size control, the podium and what it costs, and a press anywhere else on it opens
 * it out. See `MECHANICS.md`, the choice roll, and decision records 0085 and 0118.
 */
export function TakeAction({ room, along, looking }: { room: Room; along: Along; looking: () => Looking }) {
  const free = useStore(sessionStore, (state) => {
    const wealth = state.yourHouse?.resources.wealth;
    return wealth === undefined ? null : freeNow(wealth, Date.now());
  });
  const ready = useStore(sessionStore, canAct);
  // What a roll costs, as the page says it before pressing: the balance's, the file the game server reads, so the
  // button can say why it is greyed rather than be pressed to find out. A roll the house cannot pay is refused by the
  // server whatever this says. See decision records 0083 and 0097.
  const balance = useBalance();
  const cost = balance?.roll.price ?? null;
  const circleKm = balance?.omens.landingCircleKm ?? null;
  // The die on the sprite canvas, fetched once the game has started: none until then, and it cannot be lifted.
  const die = useStore(dieStore, (state) => state.hand);
  const [out, setOut] = useState(false);
  const waiting = useRef<'not' | 'sent' | 'answering'>('not');

  // Back with no hand pending, after a hand was answered: whatever die lay on the map goes back to its podium.
  useEffect(() => die?.putBack(), [die]);

  // A roll refused - the house could not pay after all - sends no hand back, and the die goes back to its podium.
  useEffect(() => {
    if (waiting.current === 'sent' && !ready) waiting.current = 'answering';
    else if (waiting.current === 'answering' && ready) {
      waiting.current = 'not';
      die?.putBack();
      setOut(false);
    }
  }, [ready, die]);

  const whyNot =
    free === null
      ? 'the house is not founded yet'
      : cost !== null && free < cost
        ? `a roll costs ${cost} wealth, and the house has ${free} free`
        : !ready
          ? 'waiting on an answer'
          : die === null || circleKm === null
            ? 'the die is on its way'
            : null;
  const price = `${cost === null ? '' : `${cost} `}${RESOURCE_WORDS.wealth.toLowerCase()}`;

  // Once it rests and has been seen resting, the roll is sent from where it landed.
  const landed = (landing: Landing) => {
    window.setTimeout(() => {
      waiting.current = 'sent';
      expectHand();
      takeAction({ ...looking(), landing });
    }, SEEN_MS);
  };
  const podium = (aside?: string) => (
    <Podium
      words="Take action"
      aside={aside}
      size={room.size === 'strip' ? 'small' : 'regular'}
      out={out}
      disabled={whyNot !== null && !out}
      onLift={(lifted) => {
        setOut(true);
        die?.pickUp(lifted, lifted.byTouch, circleKm ?? 0);
      }}
      onMove={(path) => die?.move(path)}
      onLetGo={(at) => die?.letGo(at, landed)}
      onPutBack={() => {
        die?.putBack();
        setOut(false);
      }}
      onDrop={() => {
        setOut(true);
        die?.dropAtCentre(circleKm ?? 0, landed);
      }}
    />
  );

  if (room.size === 'strip') {
    return (
      <section
        className={`choice choice--strip pane-strip${along === null ? ' choice--chip' : ''}`}
        title={whyNot ?? `costs ${price}`}
      >
        {podium()}
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
      <div className="choice__take">{podium(whyNot ?? `costs ${price}`)}</div>
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
