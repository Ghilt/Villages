import { useState } from 'react';

import { SAMPLE, towardSaid } from './setup';
import { useSimulator } from './useSimulator';
import type { Answer } from './useSimulator';

/**
 * The simulator: the game server's engine fights a challenge out and the page shows what it came to. For now one
 * sample, Violence against Diplomacy, fought from a seed the server draws; the sides, the progression and the moments
 * come in the plan's next step. Words rather than marks, as every inspect page's controls are. See decision record 0105.
 */
export function Simulator() {
  const simulator = useSimulator();
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [running, setRunning] = useState(false);
  const run = () => {
    setRunning(true);
    void simulator.simulate(SAMPLE).then((answered) => {
      setAnswer(answered);
      setRunning(false);
    });
  };
  return (
    <section className="inspect-group" aria-label="simulator">
      <h2 className="inspect-group__title">simulator</h2>
      <p className="inspect-said">
        The game server fights the sample out with the catalogue in force, not edits not yet saved: Violence,
        with Sellswords and No Quarter, against Diplomacy, with Trusted Envoy and Ines in its slot, and
        Sweeter Terms, over thirty seconds of Violence, Diplomacy, then both.
      </p>
      <button
        type="button"
        className="inspect-button"
        disabled={simulator.state !== 'open' || running}
        onClick={run}
      >
        run the sample
      </button>{' '}
      <span className={simulator.state === 'closed' ? 'inspect-note inspect-problem' : 'inspect-note'}>
        {simulator.state === 'closed'
          ? 'the game server is not running: start it to fight'
          : simulator.state === 'connecting'
            ? 'asking the game server'
            : ''}
      </span>
      {answer !== null && <Answered answer={answer} />}
    </section>
  );
}

function Answered({ answer }: { answer: Answer }) {
  if (!answer.fought)
    return (
      <p className="inspect-problem">
        refused, {answer.code}: {answer.reason}
      </p>
    );
  const { outcome, seed, moments } = answer.challenge;
  const ended = outcome.ended === 'pulled' ? 'pulled to the end' : 'time ran out';
  const won = outcome.wonBy === null ? 'won by nobody' : `won by ${outcome.wonBy.toUpperCase()}`;
  return (
    <p className="challenges-outcome">
      seed <span className="inspect-key">{seed}</span>: {ended} in second {outcome.second}, the tug{' '}
      {towardSaid(outcome.tug)}, {won}; {moments.length} moments
    </p>
  );
}
