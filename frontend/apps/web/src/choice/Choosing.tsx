import { useEffect, useState, useSyncExternalStore } from 'react';

import type { ChoiceView, OptionView } from '@villages/protocol';

import { gatewayState, takeOption, watchGateway } from '../net/gateway';
import type { Room } from '../stage/panes';

/**
 * **The choice roll**: what the world is asking, and the options it is offering.
 *
 * It renders whatever the choice says and knows nothing else about it - a prompt, and one **parchment** an
 * option. That is what lets a new kind of choice arrive with no change here at all. See decision record
 * 0034 and `MECHANICS.md`.
 *
 * A pane with three sizes, and the mechanic owns all three:
 *
 * - **Full** - the prompt and every option laid out to read through. What it arrives at, because the world
 *   has asked something and reading it is the thing to do first.
 * - **Small** - the **carousel**: one option at a time, with the way between them. For glancing at the
 *   options while looking at the map they are about, which is the whole reason the map is drawn with the
 *   offered seats marked on it.
 * - **Minimised** - set aside to a strip. Not closed: the question is still standing.
 *
 * **Its size is the player's**, alone among the panes, because the two forms are two ways of using it and
 * only they know which they are doing. Every other pane's size is the layout's answer to how much room
 * there is. See decision record 0044.
 *
 * Nothing here asks the window how wide it is. How the options lay out is a **container query** on the bay,
 * which is what replaced the one breakpoint on this mechanic that had never fired - it asked the window,
 * which is 1280 while the stage is 390. That defect outlived three decision records and is the reason
 * `RESPONSIVE-DESIGN.md` exists.
 */

export function Choosing({ room }: { room: Room }) {
  const heard = useSyncExternalStore(watchGateway, gatewayState);
  const choice = heard.yourChoice;
  const [at, setAt] = useState(0);
  const asked = choice?.id;

  // A new question starts at its first option rather than wherever the last one was left.
  useEffect(() => {
    setAt(0);
  }, [asked]);

  if (choice === null) {
    return null;
  }

  if (room.size === 'strip') {
    return (
      <section className="choice choice--strip">
        <span className="choice__aside">A letter awaits</span>
        {room.minimise !== null && (
          <button
            type="button"
            className="choice__fold"
            aria-label="read it"
            title="read it"
            onClick={room.minimise}
          >
            {'▴'}
          </button>
        )}
      </section>
    );
  }

  const answering = heard.acting !== null || heard.connection !== 'open';
  const carousel = room.size === 'small';
  const shown = Math.min(at, choice.options.length - 1);

  return (
    <section className={carousel ? 'choice choice--carousel' : 'choice'} aria-live="polite">
      <header className="choice__head">
        <h2 className="choice__prompt">{choice.prompt}</h2>
        <Chrome room={room} carousel={carousel} />
      </header>

      {carousel ? (
        <Carousel choice={choice} at={shown} onAt={setAt} answering={answering} />
      ) : (
        <ol className="choice__options">
          {choice.options.map((option) => (
            <li key={option.id}>
              <Parchment choice={choice} option={option} answering={answering} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** The pane's own buttons: which size it is, and putting it aside. Not part of the choice. */
function Chrome({ room, carousel }: { room: Room; carousel: boolean }) {
  return (
    <span className="choice__chrome">
      {room.resize !== null && (
        <button
          type="button"
          className="choice__size"
          aria-label={carousel ? 'read them all' : 'one at a time, and keep the map'}
          title={carousel ? 'read them all' : 'one at a time, and keep the map'}
          onClick={room.resize}
        >
          {carousel ? '▤' : '▭'}
        </button>
      )}
      {room.minimise !== null && (
        <button
          type="button"
          className="choice__fold"
          aria-label="set it aside"
          title="set it aside, and look at the map"
          onClick={room.minimise}
        >
          set aside
        </button>
      )}
    </span>
  );
}

/**
 * One option at a time, and the way between them.
 *
 * The map is what a choice is about and the offered seats are marked on it, so this is the form for
 * deciding rather than for reading: the option you are on stays on the screen beside the place it means.
 */
function Carousel({
  choice,
  at,
  onAt,
  answering,
}: {
  choice: ChoiceView;
  at: number;
  onAt: (at: number) => void;
  answering: boolean;
}) {
  const many = choice.options.length;
  const option = choice.options[at];
  const step = (by: number) => onAt((at + by + many) % many);

  if (option === undefined) {
    return null;
  }

  return (
    <div className="carousel">
      <button
        type="button"
        className="carousel__step"
        aria-label="the one before"
        title="the one before"
        onClick={() => step(-1)}
      >
        {'‹'}
      </button>

      <div className="carousel__sheet">
        <Parchment choice={choice} option={option} answering={answering} />
        <ol className="carousel__dots" aria-label={`option ${at + 1} of ${many}`}>
          {choice.options.map((one, index) => (
            <li
              key={one.id}
              className={index === at ? 'carousel__dot carousel__dot--at' : 'carousel__dot'}
              aria-hidden="true"
            />
          ))}
        </ol>
      </div>

      <button
        type="button"
        className="carousel__step"
        aria-label="the one after"
        title="the one after"
        onClick={() => step(1)}
      >
        {'›'}
      </button>
    </div>
  );
}

/** One option, on a sheet of parchment. The shared component; see `LOOK-AND-FEEL.md`. */
function Parchment({
  choice,
  option,
  answering,
}: {
  choice: ChoiceView;
  option: OptionView;
  answering: boolean;
}) {
  return (
    <button
      type="button"
      className="parchment"
      disabled={answering}
      onClick={() => takeOption(choice, option)}
    >
      <span className="parchment__label">{option.label}</span>
      <span className="parchment__detail">{option.detail}</span>
    </button>
  );
}
