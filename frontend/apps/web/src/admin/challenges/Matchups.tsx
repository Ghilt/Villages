import { useState } from 'react';

import type { Challenges } from '@villages/world';
import type { MatchupView, MatchupsSimulatedFrame } from '@villages/protocol';

import { numberSaid } from '../../spectacle/said';
import { said } from './setup';
import { useSimulator } from './useSimulator';
import type { Weighed } from './useSimulator';

/**
 * The classes a cell is coloured by, side A's share of the wins: the reference palette's diverging pair, red where
 * side B wins most and blue where side A does, five equal steps an arm and grey for about even. Text on the darker
 * steps is drawn light, so every number stays readable.
 */
export const SHARES: readonly { readonly upTo: number; readonly colour: string; readonly dark: boolean }[] = [
  { upTo: 0.1, colour: '#7a1b1b', dark: true },
  { upTo: 0.2, colour: '#b52f2e', dark: true },
  { upTo: 0.3, colour: '#e34948', dark: true },
  { upTo: 0.4, colour: '#f1a19f', dark: false },
  { upTo: 0.45, colour: '#fbdcdb', dark: false },
  { upTo: 0.55, colour: '#f0efec', dark: false },
  { upTo: 0.6, colour: '#cde2fb', dark: false },
  { upTo: 0.7, colour: '#86b6ef', dark: false },
  { upTo: 0.8, colour: '#3987e5', dark: true },
  { upTo: 0.9, colour: '#1c5cab', dark: true },
  { upTo: 1, colour: '#0d366b', dark: true },
];

/** The class of side A's share of the wins. */
export const shareClass = (share: number) => SHARES.find((one) => share <= one.upTo) ?? SHARES.at(-1)!;

/**
 * Side A's share of a pairing's runs that either side won: even ends are left out, so a mirror match reads about even
 * however many of its runs end level, and pointing at the cell gives them.
 */
export const shareOf = (cell: MatchupView) =>
  cell.wonByA + cell.wonByB === 0 ? 0.5 : cell.wonByA / (cell.wonByA + cell.wonByB);

const percent = (share: number) => `${Math.round(100 * share)}%`;

/** A pairing's mean end tug, said toward the aspect it leans to rather than toward a side. */
const leanSaid = (tug: number, side: string, top: string) =>
  tug === 0 ? 'even' : `${numberSaid(Math.abs(tug))} toward ${tug > 0 ? side : top}`;

/** How many runs a pairing gets: a quick look, or a closer one. */
const RUNS = [90, 900] as const;

/**
 * Every aspect weighed against every other, the balance at a glance: the game server fights a slice of each aspect
 * against a slice of each other, every way of choosing its two effects taking its turn, on progressions drawn from a
 * challenge kind - Even, every aspect alike, unless another is picked - and the page draws who won how often as a
 * grid, side A down the side and side B across the top, each cell side A's share of the wins in the diverging pair's
 * colours, with each aspect's mean as A and as B at the ends. Pointing at a cell says the whole of it.
 */
export function Matchups({ content }: { content: Challenges | null }) {
  const simulator = useSimulator();
  const kinds = content?.kinds ?? [];
  const [kind, setKind] = useState('even');
  const [weighing, setWeighing] = useState(false);
  const [weighed, setWeighed] = useState<{ answer: Weighed; took: number } | null>(null);
  const weigh = (runs: number) => {
    setWeighing(true);
    const began = performance.now();
    void simulator.weigh(kind, runs).then((answer) => {
      setWeighed({ answer, took: Math.round(performance.now() - began) });
      setWeighing(false);
    });
  };
  return (
    <section className="inspect-group" aria-label="matchups">
      <h2 className="inspect-group__title">matchups</h2>
      <p className="inspect-said">
        Every aspect against every other: a slice of the balance&apos;s first numbers for each, every way of
        choosing two of its effects taking its turn, a middling figure or building in each slot, fought on
        progressions drawn from the kind picked. Each cell is side A&apos;s share, down the side, of the runs
        either side won against side B, across the top: even ends are left out, and pointing at the cell gives
        them.
      </p>
      <div className="challenges-run inspect-each">
        <label>
          <span className="inspect-key">drawn from</span>{' '}
          <select
            aria-label="weigh on the challenge kind"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            {kinds.map((one) => (
              <option key={one.id} value={one.id}>
                {one.name}
              </option>
            ))}
          </select>
        </label>
        {RUNS.map((runs) => (
          <button
            key={runs}
            type="button"
            className="inspect-button"
            disabled={simulator.state !== 'open' || weighing || !kinds.some((one) => one.id === kind)}
            onClick={() => weigh(runs)}
          >
            weigh, {runs} a pairing
          </button>
        ))}
        <span className="inspect-note">{weighing ? 'weighing every pairing' : ''}</span>
      </div>
      {weighed !== null &&
        (weighed.answer.weighed ? (
          <Grid grid={weighed.answer.grid} took={weighed.took} />
        ) : (
          <p className="inspect-problem">
            refused, {weighed.answer.code}: {weighed.answer.reason}
          </p>
        ))}
    </section>
  );
}

function Grid({ grid, took }: { grid: MatchupsSimulatedFrame; took: number }) {
  const [hover, setHover] = useState<string | null>(null);
  const { aspects, cells, runs } = grid;
  const asA = cells.map((row) => row.reduce((sum, cell) => sum + shareOf(cell), 0) / row.length);
  const asB = aspects.map(
    (_, column) => cells.reduce((sum, row) => sum + 1 - shareOf(row[column]!), 0) / cells.length,
  );
  return (
    <div className="challenges-matchups">
      <p className="inspect-note">
        {aspects.length * aspects.length} pairings of {runs} runs, {aspects.length * aspects.length * runs}{' '}
        challenges in {took} ms, seed <span className="inspect-key">{grid.seed}</span>
      </p>
      <div className="inspect-scroll">
        <table className="challenges-grid">
          <thead>
            <tr>
              <th className="challenges-grid__corner">
                <span className="challenges-grid__top-said">across the top: side B</span>
                <span className="challenges-grid__side-said">down the side: side A</span>
              </th>
              {aspects.map((aspect) => (
                <th key={aspect} scope="col" className="challenges-grid__top">
                  {said(aspect)}
                </th>
              ))}
              <th scope="col" className="challenges-grid__mean challenges-grid__side-said">
                won, down the side
              </th>
            </tr>
          </thead>
          <tbody>
            {cells.map((row, at) => (
              <tr key={aspects[at]} className={at % 2 === 1 ? 'challenges-grid__pair-end' : undefined}>
                <th scope="row" className="challenges-grid__side">
                  {said(aspects[at]!)}
                </th>
                {row.map((cell, column) => {
                  const share = shareOf(cell);
                  const shade = shareClass(share);
                  const side = said(aspects[at]!);
                  const top = said(aspects[column]!);
                  return (
                    <td
                      key={aspects[column]}
                      className={`challenges-grid__cell${shade.dark ? ' is-dark' : ''}${column % 2 === 1 ? ' challenges-grid__pair-end' : ''}`}
                      style={{ background: shade.colour }}
                      onMouseEnter={() =>
                        setHover(
                          `${side}, down the side, won ${cell.wonByA}; ${top}, across the top, won ${cell.wonByB}; even ${cell.even}; of ${runs}. ${cell.pulled} pulled to an end; the mean end tug ${leanSaid(cell.meanTug, side, top)}`,
                        )
                      }
                      onMouseLeave={() => setHover(null)}
                    >
                      {percent(share)}
                    </td>
                  );
                })}
                <td className="challenges-grid__mean">{percent(asA[at]!)}</td>
              </tr>
            ))}
            <tr>
              <th scope="row" className="challenges-grid__mean challenges-grid__top-said">
                won, across the top
              </th>
              {asB.map((share, column) => (
                <td key={aspects[column]} className="challenges-grid__mean">
                  {percent(share)}
                </td>
              ))}
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <div className="challenges-spread__legend inspect-each">
        <span className="challenges-grid__top-said">the aspect across the top won nearly all</span>
        {SHARES.map((one) => (
          <span key={one.upTo} className="challenges-spread__swatch" style={{ background: one.colour }} />
        ))}
        <span className="challenges-grid__side-said">the aspect down the side won nearly all</span>
      </div>
      <p className="inspect-note challenges-chart__said">
        {hover ?? `point at a cell for the whole of it; ${numberSaid(runs)} runs a pairing`}
      </p>
    </div>
  );
}
