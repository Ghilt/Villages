import { ASPECTS } from '@villages/world';
import type { ChallengeKind } from '@villages/world';
import type { ProgressionView } from '@villages/protocol';

import { MOST_SECONDS, said, startsOf } from './setup';

/**
 * The progression: drawn from a challenge kind by the seed, or built by hand - how many seconds the challenge lasts,
 * and its happenings in order, each one aspect or two, beginning where the engine spaces them, never more happenings
 * than seconds. See the plan's simulator and its challenge engine.
 */
export function ProgressionEditor({
  progression,
  kind,
  kinds,
  onChange,
  onKind,
}: {
  progression: ProgressionView;
  kind: string;
  kinds: readonly ChallengeKind[];
  onChange: (progression: ProgressionView) => void;
  onKind: (kind: string) => void;
}) {
  const { seconds, happenings } = progression;
  const starts = startsOf(progression);
  const setHappening = (at: number, aspects: string[]) =>
    onChange({ seconds, happenings: happenings.map((was, index) => (index === at ? aspects : was)) });
  const drawing = kinds.find((one) => one.id === kind);
  return (
    <div className="challenges-progression">
      <h3 className="inspect-group__subtitle">progression</h3>
      <label>
        <span className="inspect-key">drawn from</span>{' '}
        <select
          aria-label="draw the progression from"
          value={kind}
          onChange={(event) => onKind(event.target.value)}
        >
          <option value="">nothing: written by hand</option>
          {kinds.map((one) => (
            <option key={one.id} value={one.id}>
              {one.name}
            </option>
          ))}
        </select>
      </label>
      {drawing !== undefined ? (
        <p className="inspect-note">
          {drawing.words} {drawing.seconds[0]} to {drawing.seconds[1]} seconds, {drawing.happenings[0]} to{' '}
          {drawing.happenings[1]} happenings, drawn from the seed: the same seed draws the same progression.
        </p>
      ) : (
        <HandWritten
          progression={progression}
          starts={starts}
          onChange={onChange}
          setHappening={setHappening}
        />
      )}
    </div>
  );
}

function HandWritten({
  progression,
  starts,
  onChange,
  setHappening,
}: {
  progression: ProgressionView;
  starts: readonly number[];
  onChange: (progression: ProgressionView) => void;
  setHappening: (at: number, aspects: string[]) => void;
}) {
  const { seconds, happenings } = progression;
  return (
    <>
      <label>
        <span className="inspect-key">seconds</span>{' '}
        <input
          className="inspect-field"
          type="number"
          aria-label="seconds"
          min={happenings.length}
          max={MOST_SECONDS}
          value={seconds}
          onChange={(event) => {
            const read = Number(event.target.value);
            if (Number.isInteger(read) && read >= happenings.length && read <= MOST_SECONDS)
              onChange({ seconds: read, happenings });
          }}
        />
      </label>
      <ol className="challenges-happenings">
        {happenings.map((aspects, at) => (
          <li key={at}>
            <span className="inspect-key">from second {starts[at]}</span>{' '}
            <AspectPick
              label={`happening ${at + 1}`}
              value={aspects[0] ?? 'violence'}
              onChange={(first) => setHappening(at, [first, ...aspects.slice(1)])}
            />{' '}
            <AspectPick
              label={`happening ${at + 1}, second aspect`}
              value={aspects[1] ?? ''}
              none
              onChange={(second) => setHappening(at, second === '' ? [aspects[0]!] : [aspects[0]!, second])}
            />{' '}
            {happenings.length > 1 && (
              <button
                type="button"
                className="inspect-button"
                onClick={() =>
                  onChange({ seconds, happenings: happenings.filter((_, index) => index !== at) })
                }
              >
                remove
              </button>
            )}
          </li>
        ))}
      </ol>
      {happenings.length < seconds && (
        <button
          type="button"
          className="inspect-button"
          onClick={() =>
            onChange({ seconds, happenings: [...happenings, [happenings.at(-1)?.[0] ?? 'violence']] })
          }
        >
          add a happening
        </button>
      )}
    </>
  );
}

function AspectPick({
  label,
  value,
  none,
  onChange,
}: {
  label: string;
  value: string;
  none?: boolean;
  onChange: (aspect: string) => void;
}) {
  return (
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      {none === true && <option value="">no second aspect</option>}
      {ASPECTS.map((aspect) => (
        <option key={aspect} value={aspect}>
          {said(aspect)}
        </option>
      ))}
    </select>
  );
}
