import { Fragment, useEffect, useMemo, useRef, useState } from 'react';

import { openDialogue } from './openDialogue';
import {
  canAct,
  choose,
  keepReading,
  type Press,
  pressNext,
  type Reading,
  showing,
} from '@villages/client-core';
import type { DialogueView, LineView, SpeakerView } from '@villages/protocol';

import { Portrait } from '../figures/Portrait';
import { Mark } from '../marks/Mark';
import { sessionStore, completeDialogueStep } from '../net/gateway';
import { Icon } from '../stage/Icons';
import { PaneSizeControl } from '../stage/PaneSizeControl';
import type { Room } from '../stage/panes';
import {
  closingLine,
  type Gain,
  gainsOf,
  gainWords,
  howMany,
  impactWords,
  type ListedDialogue,
  listOf,
  refusalWords,
  sideOf,
  signed,
} from './describe';
import { Scene } from './Scene';
import { type Beside, showWhatIsReached, taking } from './showing';
import { useStore } from '../store/useStore';

/**
 * **Character dialogue**: the conversations the house has been offered, and the one being read.
 *
 * It stands from the house's first dialogue on and is never closed after that, because the finished ones
 * are kept to be read back. In the spread it is the column down the right edge, and on a phone a pane like
 * any other. See `MECHANICS.md` and decision records 0069 and 0070.
 *
 * Two states, as the key figures' grid and details are: **the list**, the dialogues waiting and under them
 * the ones finished; and **a conversation**, opened by pressing one, with the way back to the list in its
 * head. Which is open is the pane's own state, and outlives its sizes because a pane is never unmounted.
 * Put away it is its name and how many there are.
 */
interface DialoguesProps {
  room: Room;
  /** Opens a window on a house or a person a line shows, beside this pane. Handed down; see `panes.tsx`. */
  inspect: Beside['window'];
}

export function Dialogues({ room, inspect }: DialoguesProps) {
  const dialogues = useStore(sessionStore, (state) => state.yourDialogues);
  const refused = useStore(sessionStore, (state) => state.stepRefused);
  const acting = useStore(sessionStore, canAct);
  const list = useMemo(() => listOf(dialogues ?? []), [dialogues]);
  const [open, setOpen] = useState<string | null>(null);
  // A dialogue that has gone - a wipe, another player - leaves the list behind it rather than nothing.
  const reading = dialogues?.find((one) => one.id === open) ?? null;

  // Which dialogue is being read is said beside the pane, so a choice roll can read it, and none once it goes.
  const readingId = reading?.id ?? null;
  useEffect(() => openDialogue(readingId), [readingId]);
  useEffect(() => () => openDialogue(null), []);

  if (room.size === 'strip') {
    return (
      <section className="dialogues dialogues--strip pane-strip" aria-label="Dialogues">
        <span className="dialogues__name">Dialogues</span>
        <span className="dialogues__count">{howMany(dialogues ?? [])}</span>
        <PaneSizeControl room={room} />
      </section>
    );
  }

  if (reading !== null) {
    return (
      <Conversation
        dialogue={reading}
        room={room}
        beside={{ showMap: room.showMap, window: inspect }}
        stepOut={!acting}
        refused={refused !== null && refused.dialogueId === reading.id ? refused : null}
        onBack={() => setOpen(null)}
      />
    );
  }

  return (
    <section className={`dialogues dialogues--${room.size}`} aria-label="Dialogues">
      <header className="dialogues__head">
        <h2 className="dialogues__name">Dialogues</h2>
        <PaneSizeControl room={room} />
      </header>

      <div className="dialogues__list">
        <h3 className="dialogues__group">Waiting</h3>
        {list.waiting.length === 0 ? (
          <p className="dialogues__none">Nothing is waiting.</p>
        ) : (
          <Rows dialogues={list.waiting} onOpen={setOpen} />
        )}

        {/* Finished is history, so a house with none yet is not told so. */}
        {list.finished.length > 0 && (
          <>
            <h3 className="dialogues__group">Finished</h3>
            <Rows dialogues={list.finished} onOpen={setOpen} />
          </>
        )}
      </div>
    </section>
  );
}

/** The list's rows: pressing one opens it, from its start or from where it was left, or to be read back. */
function Rows({ dialogues, onOpen }: { dialogues: readonly ListedDialogue[]; onOpen: (id: string) => void }) {
  return (
    <ol className="dialogues__rows">
      {dialogues.map((one) => (
        <li key={one.id} className={one.lapsed ? 'dialogues__row dialogues__row--lapsed' : 'dialogues__row'}>
          <button type="button" className="dialogues__open" onClick={() => onOpen(one.id)}>
            <span className="dialogues__title">{one.title}</span>
            {one.progress !== null && <span className="dialogues__progress">{one.progress}</span>}
            <span className="dialogues__line">{one.line}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

interface ConversationProps {
  dialogue: DialogueView;
  room: Room;
  /** What a line reached shows beside the pane: the map, or a window. */
  beside: Beside;
  /** Whether a step is out: nothing can be pressed until it is answered. */
  stepOut: boolean;
  /** The step through this dialogue the house last refused, and why, if one was. */
  refused: { lineId: string; reason: string } | null;
  onBack: () => void;
}

/**
 * **A conversation**: what has been said, the stretch ahead shown a line at a time by *continue* at its foot,
 * and at the end of the feed the dialogue choice's options, all of it drawn over the scene it happens in.
 *
 * Where the reading is, is `client-core`'s reading place, kept here only as state: it holds while the
 * dialogue's revision holds and starts the new stretch when a step is answered. A press either shows a line or
 * sends the step the house writes down, and the step's answer arrives as the dialogue moved on, which is what
 * moves the reading on. The bubbles are keyed by their lines, so a line said stays where it was. *Continue* is
 * a word, in the middle of the foot, because it is the one thing to press while a conversation is read and a
 * mark in the corner was too easily missed; the way back is a mark. Both Adam's call. The options are what
 * can be said, so they are words too.
 */
function Conversation({ dialogue, room, beside, stepOut, refused, onBack }: ConversationProps) {
  const [held, setHeld] = useState<Reading | null>(null);
  const reading = keepReading(held, dialogue);
  const now = useMemo(() => showing(reading, dialogue), [reading, dialogue]);
  // A refusal is said while the line it refused can still be pressed: once the dialogue has moved on,
  // here or in another window, it is no longer about anything on the screen.
  const stillThere =
    refused !== null &&
    (now.options.some((option) => option.id === refused.lineId) ||
      (now.next && dialogue.next[dialogue.next.length - 1]?.id === refused.lineId));
  const refusal = stillThere && refused !== null ? refusalWords(refused.reason) : null;

  const press = (pressed: Press | null, what: string) => {
    if (pressed === null) {
      return;
    }
    if (pressed.kind === 'show') {
      setHeld(pressed.reading);
      return;
    }
    setHeld(reading);
    taking(dialogue.id, pressed.line);
    completeDialogueStep(dialogue.id, pressed.line.id, `${what} "${pressed.line.id}" in "${dialogue.title}"`);
  };

  // What a line shows, as it is reached while playing: a line of the stretch as it shows, an option once the
  // house has taken it. Each line once in the life of the page, whatever renders it again. See `showing.ts`.
  useEffect(() => {
    showWhatIsReached(dialogue, now.lines, beside);
    // Read when a line is reached, not a reason to look again: each line shows once in the life of the page.
  }, [dialogue, now.lines]);

  // The newest line is the one to read, so the feed follows it down as lines are shown and steps answered -
  // to its very end, padding and all, which is what keeps the last option clear of the compass on a phone.
  const feed = useRef<HTMLOListElement | null>(null);
  useEffect(() => {
    const scroller = feed.current;
    if (scroller !== null) {
      scroller.scrollTop = scroller.scrollHeight;
    }
  }, [dialogue.revision, reading.shown, refusal]);

  return (
    <section className={`dialogues dialogues--${room.size} dialogues--reading`} aria-label={dialogue.title}>
      {/* Where it is happening, behind the whole of it: the conversation is drawn over its scene. */}
      {dialogue.scene !== undefined && <Scene scene={dialogue.scene} />}

      <header className="dialogues__head">
        <button
          type="button"
          className="dialogues__back"
          aria-label="all dialogues"
          title="all dialogues"
          onClick={onBack}
        >
          <Icon name="list" />
        </button>
        <h2 className="dialogues__name">{dialogue.title}</h2>
        <PaneSizeControl room={room} />
      </header>

      <ol ref={feed} className={now.next ? 'dialogues__feed dialogues__feed--above-foot' : 'dialogues__feed'}>
        {/* What a line did to the house is written under it, where it happened: the coin, +100. */}
        {dialogue.said.map((line) => (
          <Fragment key={line.id}>
            <Bubble line={line} speakers={dialogue.speakers} />
            <Gains gains={gainsOf(line.effects)} />
          </Fragment>
        ))}
        {now.lines.map((line) => (
          <Bubble key={line.id} line={line} speakers={dialogue.speakers} />
        ))}
        {/* A lapsed one ends where it stood, on its closing line in the interface's own words. */}
        {dialogue.ending.kind === 'lost' && (
          <li className="dialogues__closing">{closingLine(dialogue.ending.because, dialogue.speakers)}</li>
        )}
        {/* The options are the end of the conversation so far, so they scroll with it rather than standing
            under it: at half a phone, a foot of three options left no room for what they answer. */}
        {now.options.length > 0 && (
          <li className="dialogues__choosing">
            <ol className="dialogues__options">
              {now.options.map((option) => (
                <li key={option.id}>
                  <Option
                    option={option}
                    disabled={stepOut}
                    onTake={() => press(choose(reading, dialogue, option.id, stepOut), 'the option')}
                  />
                </li>
              ))}
            </ol>
          </li>
        )}
        {refusal !== null && (
          <li className="dialogues__refused" role="status">
            {refusal}
          </li>
        )}
      </ol>

      {now.next && (
        <footer className="dialogues__foot">
          <button
            type="button"
            className="dialogues__continue"
            disabled={stepOut}
            onClick={() => press(pressNext(reading, dialogue, stepOut), 'the step')}
          >
            continue
          </button>
        </footer>
      )}
    </section>
  );
}

/**
 * One line said, or showing: the speaker's portrait, and beside it a bubble with their name and the words,
 * from the left or the right by the speaker's party, so the two sides of a conversation face each other down
 * the feed. The portrait is the key figures' own frame, and somebody with no likeness - a messenger - is its
 * bust in soft ink, never an empty frame.
 */
function Bubble({
  line,
  speakers,
}: {
  line: Pick<LineView, 'speaker' | 'words'>;
  speakers: readonly SpeakerView[];
}) {
  const speaker = speakers.find((one) => one.id === line.speaker);
  const name = speaker?.name ?? line.speaker;
  // One party on one side and the next on the other, whatever numbers the dialogue gave them.
  const side = sideOf(speaker?.party ?? 0);
  return (
    <li className={`dialogues__said dialogues__said--${side}`}>
      <Portrait portrait={speaker?.portrait} name={name} />
      <div className="dialogues__bubble">
        <span className="dialogues__speaker">{name}</span>
        <p className="dialogues__words">{line.words}</p>
      </div>
    </li>
  );
}

/**
 * What a line said did to the house, under it in the feed: each resource's own mark from the house card,
 * and the amount - the coin, +100 - so that what the house was paid is read where it was paid, and the card
 * moves with it. Nothing at all for a line that did nothing.
 */
function Gains({ gains }: { gains: readonly Gain[] }) {
  if (gains.length === 0) {
    return null;
  }
  return (
    <li className="dialogues__gains" aria-label={gains.map(gainWords).join(', ')}>
      {gains.map((gain) => (
        <span
          key={`${gain.resource}${gain.amount}`}
          className={gain.amount > 0 ? 'dialogues__gain' : 'dialogues__gain dialogues__gain--spent'}
        >
          <Mark name={gain.resource} className="dialogues__mark" />
          {signed(gain.amount)}
        </span>
      ))}
    </li>
  );
}

/** An option of a dialogue choice: what is said, and under it what taking it will do, as the dialogue shows it. */
function Option({ option, disabled, onTake }: { option: LineView; disabled: boolean; onTake: () => void }) {
  const impact = impactWords(option.revealImpact);
  return (
    <button type="button" className="dialogues__option" disabled={disabled} onClick={onTake}>
      <span className="dialogues__saying">{option.words}</span>
      {impact !== null && <span className="dialogues__impact">{impact}</span>}
    </button>
  );
}
