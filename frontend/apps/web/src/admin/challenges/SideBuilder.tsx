import { ASPECTS, filledIn } from '@villages/world';
import type { Aspect, ChallengeEffect, Challenges } from '@villages/world';
import type { SliceView } from '@villages/protocol';

import { MOST_SLICES, STATS, said, sliceOf, standInFor } from './setup';
import type { SliceStart } from './setup';

type StandIn = NonNullable<SliceView['slotted'][string]>;

/**
 * One side of the challenge being built: its slices, one to three, each an aspect, its power, integrity and summon
 * count, two at most of its aspect's effects, and a stand-in in the slot of each that has one - a key figure made up
 * here, or a building. Nothing in the world is read. See `docs/plans/challenges.md`, the simulator.
 */
export function SideBuilder({
  side,
  slices,
  content,
  start,
  onChange,
}: {
  side: 'a' | 'b';
  slices: readonly SliceView[];
  content: Challenges;
  start: SliceStart;
  onChange: (slices: readonly SliceView[]) => void;
}) {
  const change = (at: number, slice: SliceView) =>
    onChange(slices.map((was, index) => (index === at ? slice : was)));
  return (
    <div className="challenges-side">
      <h3 className="inspect-group__subtitle">side {side.toUpperCase()}</h3>
      {slices.map((slice, at) => (
        <SliceBuilder
          key={at}
          label={`${side}${at + 1}`}
          slice={slice}
          content={content}
          onChange={(changed) => change(at, changed)}
          onRemove={slices.length > 1 ? () => onChange(slices.filter((_, index) => index !== at)) : undefined}
        />
      ))}
      {slices.length < MOST_SLICES && (
        <button
          type="button"
          className="inspect-button"
          onClick={() =>
            onChange([
              ...slices,
              sliceOf(slices.at(-1)?.aspect === 'holy' ? 'reason' : 'holy', start, content),
            ])
          }
        >
          add a slice
        </button>
      )}
    </div>
  );
}

function SliceBuilder({
  label,
  slice,
  content,
  onChange,
  onRemove,
}: {
  label: string;
  slice: SliceView;
  content: Challenges;
  onChange: (slice: SliceView) => void;
  onRemove: (() => void) | undefined;
}) {
  const own = content.effects.filter((effect) => effect.aspect === slice.aspect);
  const toggle = (effect: ChallengeEffect, on: boolean) => {
    const effects = on ? [...slice.effects, effect.id] : slice.effects.filter((id) => id !== effect.id);
    const slotted = Object.fromEntries(
      effects.flatMap((id) => {
        const kept = slice.slotted[id];
        const entry = content.effects.find((one) => one.id === id);
        if (entry?.slot == null) return [];
        return [[id, kept ?? standInFor(entry)] as const];
      }),
    );
    onChange({ ...slice, effects, slotted });
  };
  return (
    <div className="challenges-slice">
      <div className="challenges-slice__head">
        <span className="inspect-key">{label}</span>{' '}
        <select
          aria-label={`${label} aspect`}
          value={slice.aspect}
          onChange={(event) => onChange({ ...slice, aspect: event.target.value, effects: [], slotted: {} })}
        >
          {ASPECTS.map((aspect) => (
            <option key={aspect} value={aspect}>
              {said(aspect)}
            </option>
          ))}
        </select>{' '}
        {onRemove !== undefined && (
          <button type="button" className="inspect-button" onClick={onRemove}>
            remove
          </button>
        )}
      </div>
      <div className="inspect-each">
        <Count
          label={`${label} power`}
          words="power"
          value={slice.power}
          onChange={(power) => onChange({ ...slice, power })}
        />
        <Count
          label={`${label} integrity`}
          words="integrity"
          value={slice.integrity}
          onChange={(integrity) => onChange({ ...slice, integrity })}
        />
        <Count
          label={`${label} summon count`}
          words="summon count"
          value={slice.summonCount}
          whole
          onChange={(summonCount) => onChange({ ...slice, summonCount })}
        />
      </div>
      {own.map((effect) => {
        const carried = slice.effects.includes(effect.id);
        const standIn = slice.slotted[effect.id];
        const summon = content.summons.find((one) => one.id === effect.summons);
        return (
          <div key={effect.id} className="challenges-choice">
            <label className="inspect-pick">
              <input
                type="checkbox"
                checked={carried}
                disabled={!carried && slice.effects.length >= 2}
                onChange={(event) => toggle(effect, event.target.checked)}
              />{' '}
              {effect.name} <span className="challenges-fires">{effect.fires}</span>
              {effect.needs === 'match' && (
                <span className="challenges-matching"> needs a matching aspect</span>
              )}
              {effect.needs === 'anti' && <span className="challenges-matching"> needs its anti-aspect</span>}
            </label>
            <div
              className="challenges-choice__words"
              title={
                summon === undefined ? undefined : `${summon.name}: ${filledIn(summon.words, summon.numbers)}`
              }
            >
              {filledIn(effect.words, effect.numbers)}
            </div>
            {carried && standIn !== undefined && (
              <StandInBuilder
                label={`${label} ${effect.name}`}
                standIn={standIn}
                onChange={(changed) =>
                  onChange({ ...slice, slotted: { ...slice.slotted, [effect.id]: changed } })
                }
              />
            )}
          </div>
        );
      })}
      {own.length === 0 && (
        <p className="inspect-quiet">the catalogue has no effects of {slice.aspect as Aspect}</p>
      )}
    </div>
  );
}

function StandInBuilder({
  label,
  standIn,
  onChange,
}: {
  label: string;
  standIn: StandIn;
  onChange: (standIn: StandIn) => void;
}) {
  return (
    <div className="challenges-standin inspect-each">
      <input
        className="inspect-field"
        aria-label={`${label} stand-in name`}
        value={standIn.name}
        size={Math.max(8, standIn.name.length)}
        onChange={(event) => onChange({ ...standIn, name: event.target.value })}
      />
      {standIn.kind === 'building' ? (
        <Count
          label={`${label} level`}
          words="level"
          value={standIn.level}
          whole
          onChange={(level) => onChange({ ...standIn, level })}
        />
      ) : (
        STATS.map((stat) => (
          <Count
            key={stat}
            label={`${label} ${stat}`}
            words={stat}
            value={standIn.stats[stat] ?? 0}
            whole
            onChange={(value) => onChange({ ...standIn, stats: { ...standIn.stats, [stat]: value } })}
          />
        ))
      )}
    </div>
  );
}

/** A number typed in place: kept as typed while it reads, and nothing handed on while it does not. */
function Count({
  label,
  words,
  value,
  whole,
  onChange,
}: {
  label: string;
  words: string;
  value: number;
  whole?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      <span className="inspect-key">{words}</span>{' '}
      <input
        className="inspect-field"
        type="number"
        aria-label={label}
        min={0}
        step={whole === true ? 1 : 'any'}
        value={value}
        onChange={(event) => {
          const read = Number(event.target.value);
          if (
            event.target.value !== '' &&
            Number.isFinite(read) &&
            read >= 0 &&
            (whole !== true || Number.isInteger(read))
          ) {
            onChange(read);
          }
        }}
      />
    </label>
  );
}
