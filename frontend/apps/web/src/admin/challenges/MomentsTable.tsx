import { useState } from 'react';

import type { Challenges } from '@villages/world';
import type { ChallengeSimulatedFrame } from '@villages/protocol';

import { WHAT_SAID, effectSaid, numberSaid, summonNames, whoSaid } from './setup';
import type { Draft } from './setup';

/**
 * Every moment of a challenge fought, a row each, in the order they happened: the second, the happening, the side,
 * who acted and what they did, by which effect and to whom, how much - marked when boosted - the change to the tug and
 * where it stood after. A side, or one kind of moment, can be kept alone. The tabulated log the plan asks for.
 */
export function MomentsTable({
  challenge,
  draft,
  content,
}: {
  challenge: ChallengeSimulatedFrame;
  draft: Draft;
  content: Challenges | null;
}) {
  const [side, setSide] = useState<'both' | 'a' | 'b'>('both');
  const [kind, setKind] = useState('every');
  const called = summonNames(challenge.summons, content);
  const kinds = [...new Set(challenge.moments.map((moment) => moment.what))];
  const shown = challenge.moments.filter(
    (moment) =>
      (side === 'both' || moment.side === side || moment.side === null) &&
      (kind === 'every' || moment.what === kind),
  );
  return (
    <div className="challenges-moments">
      <div className="inspect-each">
        <label>
          <span className="inspect-key">side</span>{' '}
          <select
            aria-label="keep one side"
            value={side}
            onChange={(event) => setSide(event.target.value as typeof side)}
          >
            <option value="both">both</option>
            <option value="a">A</option>
            <option value="b">B</option>
          </select>
        </label>
        <label>
          <span className="inspect-key">moments</span>{' '}
          <select
            aria-label="keep one kind of moment"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            <option value="every">every kind</option>
            {kinds.map((what) => (
              <option key={what} value={what}>
                {WHAT_SAID[what] ?? what}
              </option>
            ))}
          </select>
        </label>
        <span className="inspect-note">
          {shown.length} of {challenge.moments.length} moments
        </span>
      </div>
      <div className="inspect-scroll">
        <table className="inspect-table challenges-log">
          <thead>
            <tr>
              <th>second</th>
              <th>happening</th>
              <th>side</th>
              <th>who</th>
              <th>what</th>
              <th>effect</th>
              <th>to</th>
              <th className="challenges-log__number">amount</th>
              <th className="challenges-log__number">change</th>
              <th className="challenges-log__number">tug</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((moment, at) => (
              <tr key={at} className={moment.what === 'happeningBegan' ? 'challenges-log__began' : undefined}>
                <td>{moment.second}</td>
                <td>{(challenge.progression.happenings[moment.happening] ?? []).join(' & ')}</td>
                <td>{moment.side?.toUpperCase() ?? ''}</td>
                <td>{whoSaid(moment.actor, draft, called)}</td>
                <td>{WHAT_SAID[moment.what] ?? moment.what}</td>
                <td>{effectSaid(moment.effect ?? moment.targetEffect, content)}</td>
                <td>
                  {whoSaid(moment.target, draft, called)}
                  {moment.targetEffect !== null && moment.effect !== null
                    ? ` (${effectSaid(moment.targetEffect, content)})`
                    : ''}
                </td>
                <td className="challenges-log__number">
                  {moment.amount === null ? '' : numberSaid(moment.amount)}
                  {moment.boosted ? ' ×' : ''}
                </td>
                <td className="challenges-log__number">
                  {moment.tugDelta === 0
                    ? ''
                    : `${moment.tugDelta > 0 ? '+' : ''}${numberSaid(moment.tugDelta)}`}
                </td>
                <td className="challenges-log__number">{numberSaid(moment.tugAfter)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="inspect-quiet">
        × boosted: the happening has the doer's aspect or its anti-aspect. The tug is side A's way up.
      </p>
    </div>
  );
}
