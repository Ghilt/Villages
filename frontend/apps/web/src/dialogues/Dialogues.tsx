import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { choose, keepReading, type Press, pressNext, type Reading, showing } from '@villages/client-core';
import type { DialogueView, LineView, SpeakerView } from '@villages/protocol';

import { completeDialogueStep, gatewayState, watchGateway } from '../net/gateway';
import { Icon } from '../stage/Icons';
import { PaneSizeControl } from '../stage/PaneSizeControl';
import type { Room } from '../stage/panes';
import { howMany, impactWords, type ListedDialogue, listOf } from './describe';

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
export function Dialogues({ room }: { room: Room }) {
  const heard = useSyncExternalStore(watchGateway, gatewayState);
  const dialogues = heard.yourDialogues;
  const list = useMemo(() => listOf(dialogues ?? []), [dialogues]);
  const [open, setOpen] = useState<string | null>(null);
  // A dialogue that has gone - a wipe, another player - leaves the list behind it rather than nothing.
  const reading = dialogues?.find((one) => one.id === open) ?? null;

  if (room.size === 'strip') {
    return (
      <section className="dialogues dialogues--strip" aria-label="Dialogues">
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
        stepOut={heard.acting !== null}
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
  /** Whether a step is out: nothing can be pressed until it is answered. */
  stepOut: boolean;
  onBack: () => void;
}

/**
 * **A conversation**: what has been said, the stretch ahead shown a line at a time, and at its foot *next* or
 * the dialogue choice's options.
 *
 * Where the reading is, is `client-core`'s reading place, kept here only as state: it holds while the
 * dialogue's revision holds and starts the new stretch when a step is answered. A press either shows a line or
 * sends the step the house writes down, and the step's answer arrives as the dialogue moved on, which is what
 * moves the reading on. The bubbles are keyed by their lines, so a line said stays where it was. *Next* and the
 * way back are marks, Adam's call; the options are what can be said, so they are words.
 */
function Conversation({ dialogue, room, stepOut, onBack }: ConversationProps) {
  const [held, setHeld] = useState<Reading | null>(null);
  const reading = keepReading(held, dialogue);
  const now = showing(reading, dialogue);

  const press = (pressed: Press | null, what: string) => {
    if (pressed === null) {
      return;
    }
    if (pressed.kind === 'show') {
      setHeld(pressed.reading);
      return;
    }
    setHeld(reading);
    completeDialogueStep(dialogue.id, pressed.line.id, `${what} "${pressed.line.id}" in "${dialogue.title}"`);
  };

  // The newest line is the one to read, so the feed follows it down as lines are shown and steps answered -
  // to its very end, padding and all, which is what keeps the last option clear of the compass on a phone.
  const feed = useRef<HTMLOListElement | null>(null);
  useEffect(() => {
    const scroller = feed.current;
    if (scroller !== null) {
      scroller.scrollTop = scroller.scrollHeight;
    }
  }, [dialogue.revision, reading.shown]);

  return (
    <section className={`dialogues dialogues--${room.size} dialogues--reading`} aria-label={dialogue.title}>
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

      <ol ref={feed} className="dialogues__feed">
        {dialogue.said.map((line) => (
          <Bubble key={line.id} line={line} speakers={dialogue.speakers} />
        ))}
        {now.lines.map((line) => (
          <Bubble key={line.id} line={line} speakers={dialogue.speakers} />
        ))}
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
      </ol>

      {now.next && (
        <footer className="dialogues__foot">
          <button
            type="button"
            className="dialogues__next"
            aria-label="next"
            title="next"
            disabled={stepOut}
            onClick={() => press(pressNext(reading, dialogue, stepOut), 'the step')}
          >
            <Icon name="next" />
          </button>
        </footer>
      )}
    </section>
  );
}

/**
 * One line said, or showing: who says it and the words, from the left or the right by the speaker's party,
 * so the two sides of a conversation face each other down the feed.
 */
function Bubble({
  line,
  speakers,
}: {
  line: Pick<LineView, 'speaker' | 'words'>;
  speakers: readonly SpeakerView[];
}) {
  const speaker = speakers.find((one) => one.id === line.speaker);
  // One party on one side and the next on the other, whatever numbers the dialogue gave them.
  const side = (speaker?.party ?? 0) % 2 === 0 ? 'left' : 'right';
  return (
    <li className={`dialogues__bubble dialogues__bubble--${side}`}>
      <span className="dialogues__speaker">{speaker?.name ?? line.speaker}</span>
      <p className="dialogues__words">{line.words}</p>
    </li>
  );
}

/** An option of a dialogue choice: what is said, and under it what taking it will do, as the dialogue shows it. */
function Option({ option, disabled, onTake }: { option: LineView; disabled: boolean; onTake: () => void }) {
  const impact = impactWords(option.revealImpact);
  return (
    <button type="button" className="dialogues__option" disabled={disabled} onClick={onTake}>
      <span className="dialogues__said">{option.words}</span>
      {impact !== null && <span className="dialogues__impact">{impact}</span>}
    </button>
  );
}
