import { useSyncExternalStore } from 'react';

import { ageOn } from '@villages/client-core';
import type { KeyFigureView, StatName } from '@villages/protocol';

import { STATS_IN_ORDER, STAT_WORDS, fullName } from '../figures/describe';
import { anotherPortrait, portraitsNow } from '../figures/portraits';
import {
  addKeyFigure,
  ageCharacter,
  changePortrait,
  changeStat,
  gatewayState,
  killCharacter,
  watchGateway,
} from '../net/gateway';
import { note } from './log';
import { Section } from './Section';

/** As many as a house may hold. The server refuses a tenth; the lever says so before it is pressed. */
const MOST_KEY_FIGURES = 9;

/** How far one press of an age lever moves somebody. Ten, so a change shows at a glance in the age. */
const AGE_STEP = 10;

/** What a death from this panel is put down to, since a death is always for a cause. */
const CAUSE = 'killed from the debug panel';

/**
 * Gives somebody another portrait from Adam's folder, one that suits them, at random.
 *
 * The folder is asked afresh on every press, so a picture saved into it a moment ago is among the ones
 * that can come up. A folder with no other that suits them says so in the log rather than doing nothing.
 */
function anotherPortraitFor(figure: KeyFigureView): void {
  portraitsNow().then(
    (keys) => {
      const next = anotherPortrait(keys, figure.sex, figure.portrait, (count) =>
        Math.floor(Math.random() * count),
      );
      if (next === null) {
        note('characters', `no other portrait in world/portraits suits ${fullName(figure)}`);
        return;
      }
      changePortrait(figure, next);
    },
    (cause: Error) => note('characters', `could not read the portraits: ${cause.message}`),
  );
}

/**
 * A house's key figures, and the levers that change them, on purpose.
 *
 * **Adam's levers, not a player's.** A house takes key figures in only from here: nothing in the game
 * gives it one, changes a stat, ages anyone or kills them yet. Every lever is a real command and goes the
 * whole way round, so the numbers here move when the world says they have and not when a button is
 * pressed. The stat levers stay pressable at one and at twenty, so that the server's refusal can be seen
 * in the log rather than guessed at from a greyed button. See decision records 0023 and 0055.
 */
export function CharactersSection() {
  const heard = useSyncExternalStore(watchGateway, gatewayState);
  const yours = heard.yourHouse;
  const figures = heard.yourKeyFigures ?? [];
  const today = heard.world?.today ?? null;
  const idle = heard.connection !== 'open' || yours === null;
  const full = figures.length >= MOST_KEY_FIGURES;

  const whyNot =
    heard.connection !== 'open'
      ? 'not connected to the world'
      : yours === null
        ? 'no house yet; found one in World first'
        : full
          ? `this house holds ${MOST_KEY_FIGURES}, which is as many as a house can`
          : 'roll a newcomer, eighteen to fifty, and take them in as a key figure of this house';

  return (
    <Section name="Characters">
      <div className="debug__levers">
        <button
          type="button"
          className="debug__button"
          disabled={idle || full}
          title={whyNot}
          onClick={addKeyFigure}
        >
          add a key figure
        </button>
        {yours !== null && (
          <span className="debug__quiet">
            {figures.length} of {MOST_KEY_FIGURES}
          </span>
        )}
      </div>

      {yours === null ? (
        <p className="debug__quiet">no house yet; found one in World first</p>
      ) : figures.length === 0 ? (
        <p className="debug__quiet">no key figures yet</p>
      ) : (
        <ol className="debug__figures">
          {figures.map((figure) => (
            <Figure key={figure.id} figure={figure} today={today} idle={idle} />
          ))}
        </ol>
      )}
    </Section>
  );
}

interface FigureProps {
  figure: KeyFigureView;
  today: number | null;
  idle: boolean;
}

/** One key figure: who they are, a row a stat with its two levers, and the levers for the whole of them. */
function Figure({ figure, today, idle }: FigureProps) {
  const name = fullName(figure);
  const who =
    today === null
      ? `a ${figure.sex}`
      : `a ${figure.sex} of ${ageOn(figure.bornOn, figure.agedYears, today)}`;
  const likeness = figure.portrait === undefined ? 'no portrait' : `portrait ${figure.portrait}`;

  const stepper = (stat: StatName, by: number, word: string, limit: string) => (
    <button
      type="button"
      className="debug__button"
      disabled={idle}
      title={`${by > 0 ? 'one more' : 'one less'} ${STAT_WORDS[stat].toLowerCase()} for ${name}; refused ${limit}`}
      onClick={() => changeStat(figure, stat, by)}
    >
      {word}
    </button>
  );

  return (
    <li className="debug__figure">
      <div className="debug__figure-who">
        <span>{name}</span>
        <span className="debug__quiet">
          {who}, {likeness}
        </span>
      </div>

      <ul className="debug__stocks debug__stocks--two">
        {STATS_IN_ORDER.map((stat) => (
          <li className="debug__stock" key={stat}>
            <span className="debug__stock-name">{STAT_WORDS[stat]}</span>
            <span className="debug__stock-figure">{figure.stats[stat]}</span>
            {stepper(stat, 1, 'up', 'past twenty')}
            {stepper(stat, -1, 'down', 'below one')}
          </li>
        ))}
      </ul>

      <div className="debug__levers">
        <button
          type="button"
          className="debug__button"
          disabled={idle}
          title={`age ${name} by ${AGE_STEP} years, out of the ordinary`}
          onClick={() => ageCharacter(figure, AGE_STEP)}
        >
          ten years older
        </button>
        <button
          type="button"
          className="debug__button"
          disabled={idle}
          title={`make ${name} ${AGE_STEP} years younger; refused younger than newborn`}
          onClick={() => ageCharacter(figure, -AGE_STEP)}
        >
          ten years younger
        </button>
        <button
          type="button"
          className="debug__button"
          disabled={idle}
          title={`give ${name} another portrait from world/portraits, one that suits them`}
          onClick={() => anotherPortraitFor(figure)}
        >
          another portrait
        </button>
        <button
          type="button"
          className="debug__button"
          disabled={idle}
          title={`kill ${name}, which takes them from every house that holds them`}
          onClick={() => killCharacter(figure, CAUSE)}
        >
          kill
        </button>
      </div>
    </li>
  );
}
