import { useEffect, useMemo, useState } from 'react';

import { canAct } from '@villages/client-core';
import type { Looking } from '@villages/client-core';
import type { ChoiceView, OmenView, OptionView } from '@villages/protocol';

import { sessionStore, takeOption } from '../net/gateway';
import { dieStore } from '../sprites/die/hand';
import { PaneSizeControl } from '../stage/PaneSizeControl';
import type { Along, Room } from '../stage/panes';
import { useStore } from '../store/useStore';
import { Card } from '../ui/card/Card';
import { OmenStrip } from '../ui/report/ReportCard';
import type { OmenLine } from '../ui/report/ReportCard';
import { RolledHand } from '../ui/report/RolledHand';
import type { HandForm } from '../ui/report/RolledHand';
import { usePlay } from '../ui/report/usePlay';
import { handExpected, overOf } from './rolling';
import { TakeAction, gives } from './TakeAction';

/** An omen off the wire as the report card shows it. */
const lineOf = (omen: OmenView): OmenLine =>
  omen.value === undefined
    ? { key: omen.key, kind: omen.kind, words: omen.words }
    : { key: omen.key, kind: omen.kind, words: omen.words, value: omen.value };

/**
 * **The choice roll**: what the world is asking, and the options it is offering.
 *
 * It renders whatever the choice says and knows nothing else about it - a prompt, and one **parchment** an
 * option. That is what lets a new kind of choice arrive with no change here at all. See decision record
 * 0034 and `MECHANICS.md`.
 *
 * A pane with three sizes on a phone and two on a desktop, and the mechanic owns them all:
 *
 * - **Full** - the prompt and every option laid out to read through. What it arrives at, because the world
 *   has asked something and reading it is the thing to do first. On a desktop it lies over everything else.
 * - **Small**, on a phone - the **carousel**: one option at a time, with the way between them. For glancing at
 *   the options while looking at the map they are about.
 * - **Minimised** - set aside to a strip, or on a desktop a chip in the middle of the bottom row with no size
 *   control, because pressing it opens it. Not closed: the question is still standing.
 *
 * See decision records 0044 and 0085.
 *
 * Nothing here asks how big anything is. Whether there is room for the list at all is the layout's answer,
 * handed down as the size; whether that list is three across or one under another is a **container query**
 * on the bay. Between them they replaced the one breakpoint on this mechanic that had never fired - it
 * asked the window, which is 1280 while the stage is 390. That defect outlived four decision records and is
 * the reason `RESPONSIVE-DESIGN.md` exists.
 *
 * Its two buttons are marks and no words, drawn as the house card's chevron is: putting a pane away is one
 * gesture wherever it is offered, and spelling it out in words here would make it two things to learn.
 */

export function Choosing({ room, along, looking }: { room: Room; along: Along; looking: () => Looking }) {
  const choice = useStore(sessionStore, (state) => state.yourChoice);
  const answering = !useStore(sessionStore, canAct);
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState<string | null>(null);
  const asked = choice?.id;
  const rolled = choice?.options[0]?.rarity;

  // A new question starts at its first option rather than wherever the last one was left, and a hand this page
  // rolled is played: the omens land, the rarity is stamped, the options pop in. See decision record 0083.
  useEffect(() => {
    setAt(0);
    if (asked !== undefined && rolled !== undefined && handExpected()) setPlaying(asked);
  }, [asked, rolled]);

  // While a rolled hand is open its die lies where it fell, after a reload too; once it is answered the die goes back
  // to its podium. A die already lying there from the throw is left as it is. See decision record 0118.
  const die = useStore(dieStore, (state) => state.hand);
  const landing = choice?.landing;
  const circleKm = choice?.circleKm;
  useEffect(() => {
    if (die === null) return;
    if (landing === undefined) die.putBack();
    else die.lieAt(landing, circleKm ?? 0);
  }, [die, landing?.lat, landing?.lon, circleKm]);

  const omens = useMemo(() => (choice?.omens ?? []).map(lineOf), [choice]);
  const { play, hurry } = usePlay(playing, omens.length, choice?.options.length ?? 0);

  if (choice === null) {
    return <TakeAction room={room} along={along} looking={looking} />;
  }

  if (room.size === 'strip') {
    const rolled = choice.options[0]?.rarity;
    return (
      <section className={`choice choice--strip pane-strip${along === null ? ' choice--chip' : ''}`}>
        <span className="choice__aside">
          {rolled === undefined
            ? 'A letter awaits'
            : `${rolled === 'uncommon' ? 'An' : 'A'} ${rolled} hand awaits`}
        </span>
        {along !== null && <PaneSizeControl room={room} />}
      </section>
    );
  }

  // A rolled hand: the omens and the options under them - the list on top on a desktop, and everything one under
  // another, scrolling, on a phone. See 0083.
  if (rolled !== undefined) {
    const form: HandForm = along === null ? 'full' : 'stacked';
    return (
      <section className={`choice choice--hand choice--${form}${overOf(along)}`} aria-live="polite">
        <header className="choice__head">
          <h2 className="choice__prompt">{choice.prompt}</h2>
          <PaneSizeControl room={room} />
        </header>
        <RolledHand
          form={form}
          omens={omens}
          play={play}
          options={choice.options.map((option) => (
            <Parchment key={option.id} choice={choice} option={option} answering={answering} omens={omens} />
          ))}
          onHurry={hurry}
        />
      </section>
    );
  }

  const carousel = room.size === 'small';
  const shown = Math.min(at, choice.options.length - 1);

  return (
    <section className={`choice${carousel ? ' choice--carousel' : ''}${overOf(along)}`} aria-live="polite">
      <header className="choice__head">
        <h2 className="choice__prompt">{choice.prompt}</h2>
        <PaneSizeControl room={room} />
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

/**
 * One option: a rolled one as the library's card edged in its rarity, saying what it gives; any other on a sheet of
 * parchment, the shared component; see `LOOK-AND-FEEL.md`.
 */
function Parchment({
  choice,
  option,
  answering,
  omens = [],
}: {
  choice: ChoiceView;
  option: OptionView;
  answering: boolean;
  /** The omens of the roll that dealt it, of which the option carries the marks of those that brought it. */
  omens?: readonly OmenLine[];
}) {
  if (option.rarity !== undefined) {
    return (
      <Card
        rarity={option.rarity}
        title={option.label}
        line={gives(option)}
        disabled={answering}
        onPress={() => takeOption(choice, option)}
      >
        <div className="choice__more">
          <p className="ui-body">{option.detail}</p>
          <OmenStrip omens={omens.filter((omen) => option.omens?.includes(omen.key))} small />
        </div>
      </Card>
    );
  }

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
