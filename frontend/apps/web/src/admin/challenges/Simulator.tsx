import { useState } from 'react';

import { parseBalance } from '@villages/world';
import type { Challenges } from '@villages/world';

import { Spectacle } from '../../spectacle/Spectacle';
import type { HouseShown, Striking } from '../../spectacle/Spectacle';
import { LOOKS } from '../../ui/lightning/strike';
import { useCatalogue } from '../frame/useCatalogue';
import { MomentsTable } from './MomentsTable';
import { ProgressionEditor } from './ProgressionEditor';
import { SideBuilder } from './SideBuilder';
import { SpreadChart } from './SpreadChart';
import { FIRST_SLICE, SAMPLE, askedOf, seedReads, towardSaid, tugBySecond } from './setup';
import type { Draft } from './setup';
import { TugChart } from './TugChart';
import { useSimulator } from './useSimulator';
import type { Answer } from './useSimulator';

/**
 * The simulator: a challenge built here - each side's slices with stand-ins in their slots, a progression written by
 * hand or drawn from a kind, a seed or none - fought out by the game server's engine on the catalogue in force, and
 * every moment of it shown: what it came to, the tug drawn second by second, and the moments as a table. The same seed
 * fights the same challenge, so a strange one can be fought again and read; a batch of a hundred or ten thousand says how
 * often each side wins. Words rather than marks, as every inspect page's controls are. 0107.
 */
export function Simulator({ content }: { content: Challenges | null }) {
  const simulator = useSimulator();
  const balance = useCatalogue('balance.json', parseBalance);
  const rules = balance.state === 'read' ? balance.shelved.value.challenge : null;
  const start = rules?.slice ?? FIRST_SLICE;
  const [draft, setDraft] = useState<Draft>(SAMPLE);
  const [fought, setFought] = useState<{ answer: Answer; draft: Draft; took: number } | null>(null);
  const [running, setRunning] = useState(false);
  const run = (runs: number) => {
    setRunning(true);
    const asked = draft;
    const began = performance.now();
    void simulator.simulate({ ...askedOf(asked), ...(runs > 1 ? { runs } : {}) }).then((answer) => {
      setFought({ answer, draft: asked, took: Math.round(performance.now() - began) });
      setRunning(false);
    });
  };
  const blocked = simulator.state !== 'open' || running || !seedReads(draft.seed);
  return (
    <section className="inspect-group" aria-label="simulator">
      <h2 className="inspect-group__title">simulator</h2>
      <p className="inspect-said">
        Build two sides and a progression, and the game server fights them out with the catalogue in force -
        not edits not yet saved - from the seed given, or from one it draws. The same seed fights the same
        challenge again.
      </p>
      {content === null ? (
        <p className="inspect-quiet">the simulator builds slices from the catalogue, which is not read yet</p>
      ) : (
        <div className="challenges-sides">
          <SideBuilder
            side="a"
            slices={draft.a}
            content={content}
            start={start}
            onChange={(a) => setDraft({ ...draft, a })}
          />
          <SideBuilder
            side="b"
            slices={draft.b}
            content={content}
            start={start}
            onChange={(b) => setDraft({ ...draft, b })}
          />
        </div>
      )}
      <ProgressionEditor
        progression={draft.progression}
        kind={draft.kind}
        kinds={content?.kinds ?? []}
        onChange={(progression) => setDraft({ ...draft, progression })}
        onKind={(kind) => setDraft({ ...draft, kind })}
      />
      <div className="challenges-run inspect-each">
        <label>
          <span className="inspect-key">seed</span>{' '}
          <input
            className={`inspect-field${seedReads(draft.seed) ? '' : ' is-wrong'}`}
            aria-label="seed, empty to draw one"
            placeholder="drawn"
            value={draft.seed}
            size={18}
            onChange={(event) => setDraft({ ...draft, seed: event.target.value })}
          />
        </label>
        {[1, 100, 10_000].map((runs) => (
          <button
            key={runs}
            type="button"
            className="inspect-button"
            disabled={blocked}
            onClick={() => run(runs)}
          >
            {runs === 1 ? 'run' : `run ${runs}`}
          </button>
        ))}
        <span className={simulator.state === 'closed' ? 'inspect-note inspect-problem' : 'inspect-note'}>
          {simulator.state === 'closed'
            ? 'the game server is not running: start it to fight'
            : simulator.state === 'connecting'
              ? 'asking the game server'
              : running
                ? 'fighting'
                : ''}
        </span>
      </div>
      {fought !== null && (
        <Fought
          answer={fought.answer}
          draft={fought.draft}
          took={fought.took}
          content={content}
          ends={rules?.tugEnds ?? 100}
          onAgain={(seed) => setDraft({ ...draft, seed: String(seed) })}
        />
      )}
    </section>
  );
}

/** The two sides as the spectacle shows them, which have no houses on this page: A in lapis, B in vermilion. */
const SIDES_SHOWN: Readonly<Record<'a' | 'b', HouseShown>> = {
  a: { name: 'A', colour: '#3d6aa6' },
  b: { name: 'B', colour: '#a8452a' },
};

/** How the spectacle is held on the page: wide, deep as a screen turned on its end, or as a phone in the hand. */
type Holding = 'wide' | 'deep' | 'phone';
const HOLDS: readonly { readonly held: Holding; readonly said: string }[] = [
  { held: 'wide', said: 'held wide' },
  { held: 'deep', said: 'held deep' },
  { held: 'phone', said: 'as a phone' },
];

/** How a happening's lightning is drawn, to be chosen between by watching: as strokes, or by a shader. */
const GLOWS: readonly Striking['glow'][] = ['strokes', 'shader'];

function Fought({
  answer,
  draft,
  took,
  content,
  ends,
  onAgain,
}: {
  answer: Answer;
  draft: Draft;
  took: number;
  content: Challenges | null;
  ends: number;
  onAgain: (seed: number) => void;
}) {
  const [held, setHeld] = useState<Holding>('wide');
  const [striking, setStriking] = useState<Striking>({ look: 'leader', glow: 'shader' });
  if (!answer.fought) {
    return (
      <p className="inspect-problem">
        refused, {answer.code}: {answer.reason}
      </p>
    );
  }
  const { outcome, seed, moments, progression, batch } = answer.challenge;
  const ended = outcome.ended === 'pulled' ? 'pulled to the end' : 'time ran out';
  const won = outcome.wonBy === null ? 'won by nobody' : `won by ${outcome.wonBy.toUpperCase()}`;
  return (
    <div className="challenges-fought">
      {batch !== undefined && (
        <p className="challenges-outcome">
          {batch.runs} runs, in {took} ms: A won {batch.wonByA}, B won {batch.wonByB}, even {batch.even};
          pulled to the end by A {batch.pulledByA} and by B {batch.pulledByB}; the mean end tug{' '}
          {towardSaid(batch.meanTug)}. The first run, below, is the seed's.
        </p>
      )}
      {batch === undefined && content !== null && (
        <>
          <p className="challenges-held">
            {HOLDS.map((one) => (
              <button
                key={one.held}
                type="button"
                className="inspect-button"
                aria-pressed={held === one.held}
                onClick={() => setHeld(one.held)}
              >
                {one.said}
              </button>
            ))}
          </p>
          <p className="challenges-held">
            <span className="inspect-note">lightning</span>
            {LOOKS.map((look) => (
              <button
                key={look}
                type="button"
                className="inspect-button"
                aria-pressed={striking.look === look}
                onClick={() => setStriking({ ...striking, look })}
              >
                {look}
              </button>
            ))}
            <span className="inspect-note">drawn as</span>
            {GLOWS.map((glow) => (
              <button
                key={glow}
                type="button"
                className="inspect-button"
                aria-pressed={striking.glow === glow}
                onClick={() => setStriking({ ...striking, glow })}
              >
                {glow}
              </button>
            ))}
          </p>
          <div className={`challenges-spectacle challenges-spectacle--${held}`}>
            <Spectacle
              key={`${seed}-${moments.length}`}
              run={answer.challenge}
              sides={draft}
              content={content}
              houses={SIDES_SHOWN}
              held={held === 'wide' ? 'wide' : 'deep'}
              striking={striking}
            />
          </div>
        </>
      )}
      <p className="challenges-outcome">
        seed <span className="inspect-key">{seed}</span>{' '}
        <button type="button" className="inspect-button" onClick={() => onAgain(seed)}>
          keep this seed
        </button>{' '}
        {ended} in second {outcome.second}, the tug {towardSaid(outcome.tug)}, {won}; {moments.length} moments
      </p>
      {outcome.gains.map((gain, at) => (
        <p key={`gain-${at}`} className="inspect-note">
          gained: {gain.side.toUpperCase()} {gain.amount} {gain.resource}, by {gain.effect}
        </p>
      ))}
      {outcome.losses.map((loss, at) => (
        <p key={`loss-${at}`} className="inspect-note">
          lost: {loss.side.toUpperCase()} {loss.name} {loss.became}, {loss.effectiveness}% effectiveness
        </p>
      ))}
      {batch === undefined ? (
        <TugChart tugs={tugBySecond(moments, progression.seconds)} progression={progression} ends={ends} />
      ) : (
        <SpreadChart
          batch={batch}
          seedTugs={tugBySecond(moments, progression.seconds)}
          progression={progression}
          happenings={draft.kind === ''}
        />
      )}
      <MomentsTable challenge={answer.challenge} draft={draft} content={content} />
    </div>
  );
}
