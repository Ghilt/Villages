import './performance.css';

import { useEffect, useState } from 'react';

import { InspectPage } from '../frame/InspectPage';
import { LineChart } from './LineChart';
import { TRIPS, judged, p95, parseRuns, rampedTo, runName, sharedLoad, stageAt } from './runs';
import type { Run } from './runs';

/** The three trips' colours, checked for colour-blind separation on the page's paper; labels and a table carry them too. */
const COLOURS = { WELCOME: '#2a78d6', ACCEPTED: '#eb6834', SNAPSHOT: '#1baf7a' } as const;
const ONE = '#2a78d6';

type Reading =
  | { state: 'reading' }
  | { state: 'read'; runs: readonly Run[]; unreadable: number }
  | { state: 'unread'; problem: string };

/**
 * How many players one game server carries, run by run: the history the bot swarm writes down, read from
 * `docs/experiments/performance/runs.jsonl`. Whether a step made the server carry fewer, or answer slower under the
 * same load, is read off the first two charts; one run's stages, and where it bent, off the rest. Nothing on it is
 * measured by the page: a run is `./gradlew :load-bots:swarm`. See `docs/plans/bot-swarm.md`.
 */
export function Performance() {
  const [reading, setReading] = useState<Reading>({ state: 'reading' });
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    fetch('/performance/runs.jsonl')
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error(`${response.status}`))))
      .then((text) => setReading({ state: 'read', ...parseRuns(text) }))
      .catch((problem: unknown) =>
        setReading({ state: 'unread', problem: `could not read the runs: ${String(problem)}` }),
      );
  }, []);

  const runs = reading.state === 'read' ? reading.runs : [];
  const run = runs.find((each) => each.at === chosen) ?? runs.at(-1);

  return (
    <InspectPage
      title="Performance"
      epigraph="How many players one game server carries, run by run"
      bar={
        <span className="inspect-note">
          from docs/experiments/performance/runs.jsonl
          {reading.state === 'read' && `, ${runs.length} ${runs.length === 1 ? 'run' : 'runs'}`}
          {reading.state === 'read' &&
            reading.unreadable > 0 &&
            `, ${reading.unreadable} lines that are not runs`}
        </span>
      }
    >
      {reading.state === 'reading' && <p className="inspect-quiet">reading the runs</p>}
      {reading.state === 'unread' && <p className="inspect-problem">{reading.problem}</p>}
      {reading.state === 'read' && runs.length === 0 && (
        <p className="inspect-quiet">No run yet. One is `cd backend` then `./gradlew :load-bots:swarm`.</p>
      )}
      {run !== undefined && (
        <>
          <Headline run={run} />
          <History runs={runs} />
          <OneRun run={run} runs={runs} choose={setChosen} />
        </>
      )}
    </InspectPage>
  );
}

function Headline({ run }: { run: Run }) {
  const said = run.aborted
    ? `aborted: ${run.abortedWhy ?? 'no reason given'}`
    : run.bentAt !== null
      ? `bent at ${run.bentAt.toLocaleString('en-GB')}: ${run.bent ?? ''}`
      : `did not bend, on a ramp that stopped at ${(rampedTo(run) ?? 0).toLocaleString('en-GB')}`;
  return (
    <section className="perf-headline" aria-label="the latest run">
      <div className="perf-tile">
        <span className="perf-tile__value">
          {run.carried === null ? '-' : run.carried.toLocaleString('en-GB')}
        </span>
        <span className="perf-tile__words">players carried, {said}</span>
      </div>
      <div className="perf-tile">
        <span className="perf-tile__value">
          {run.startupMs === null ? '-' : `${(run.startupMs / 1000).toFixed(1)} s`}
        </span>
        <span className="perf-tile__words">for the server to answer, from nothing</span>
      </div>
      <p className="inspect-said">
        {runName(run)} on {run.code.branch}, {run.machine.cpu}, {run.machine.cores} threads,{' '}
        {run.machine.memoryGb} GB, the server held to {run.serverHeapGb} GB; each stage held{' '}
        {run.settings.holdMs / 1000} s, bending at a p95 over {run.settings.bendMs} ms. The bots run on the
        same machine and take some of its CPU.
      </p>
    </section>
  );
}

function History({ runs }: { runs: readonly Run[] }) {
  const labels = runs.map(runName);
  const load = sharedLoad(runs);
  const bendMs = runs.at(-1)?.settings.bendMs ?? 500;
  return (
    <section className="inspect-group" aria-label="run by run">
      <h2 className="inspect-group__title">Run by run</h2>
      <p className="inspect-said">
        The players each run carried before it bent; fewer than the run before is a step that cost something.
      </p>
      <LineChart
        label="players carried, run by run"
        labels={labels}
        unit="players"
        series={[{ name: 'carried', colour: ONE, values: runs.map((run) => run.carried) }]}
      />
      {load !== null && (
        <>
          <p className="inspect-said">
            The slowest twentieth of each round trip at {load.toLocaleString('en-GB')} players, the largest
            load every run carried: the same load, so a slower answer is the code&apos;s.
          </p>
          <LineChart
            label={`p95 round trips at ${load} players, run by run`}
            labels={labels}
            unit="ms"
            threshold={{ value: bendMs, words: `bends over ${bendMs} ms` }}
            series={TRIPS.map((trip) => ({
              name: trip.words,
              colour: COLOURS[trip.key],
              values: runs.map((run) => p95(stageAt(run, load), trip.key)),
            }))}
          />
        </>
      )}
    </section>
  );
}

function OneRun({ run, runs, choose }: { run: Run; runs: readonly Run[]; choose: (at: string) => void }) {
  const stages = judged(run);
  const labels = stages.map((stage) => stage.players.toLocaleString('en-GB'));
  return (
    <section className="inspect-group" aria-label="one run">
      <h2 className="inspect-group__title">
        One run, stage by stage{' '}
        <select className="perf-pick" value={run.at} onChange={(event) => choose(event.target.value)}>
          {runs.map((each) => (
            <option key={each.at} value={each.at}>
              {runName(each)}
            </option>
          ))}
        </select>
      </h2>
      <p className="inspect-said">
        The slowest twentieth of each round trip as players were added, and the server&apos;s heap after a
        collection.
      </p>
      <LineChart
        label="p95 round trips by players"
        labels={labels}
        unit="ms"
        threshold={{ value: run.settings.bendMs, words: `bends over ${run.settings.bendMs} ms` }}
        series={TRIPS.map((trip) => ({
          name: trip.words,
          colour: COLOURS[trip.key],
          values: stages.map((stage) => p95(stage, trip.key)),
        }))}
      />
      <LineChart
        label="heap after a collection by players"
        labels={labels}
        unit="MB"
        threshold={{ value: run.serverHeapGb * 1024, words: `the server's ${run.serverHeapGb} GB` }}
        series={[{ name: 'heap', colour: ONE, values: stages.map((stage) => stage.reading.heapUsedMb) }]}
      />
      <table className="inspect-table perf-table">
        <thead>
          <tr>
            <th>players</th>
            {TRIPS.map((trip) => (
              <th key={trip.key} title={trip.what}>
                {trip.words} p50/95/99 ms
              </th>
            ))}
            <th>failed</th>
            <th>lost</th>
            <th>heap MB</th>
            <th>threads</th>
            <th>cpu s</th>
            <th>bent</th>
          </tr>
        </thead>
        <tbody>
          {run.stages.map((stage) => (
            <tr
              key={`${stage.players} ${stage.warmUp}`}
              className={stage.warmUp ? 'perf-table__warm' : undefined}
            >
              <td>
                {stage.players.toLocaleString('en-GB')}
                {stage.warmUp ? ' warm-up' : ''}
              </td>
              {TRIPS.map((trip) => {
                const took = stage.trips[trip.key];
                return <td key={trip.key}>{took == null ? '-' : `${took.p50}/${took.p95}/${took.p99}`}</td>;
              })}
              <td>{stage.failedTrips}</td>
              <td>{stage.lostBots}</td>
              <td>{stage.reading.heapUsedMb.toLocaleString('en-GB')}</td>
              <td>{stage.reading.threads}</td>
              <td>{(stage.cpuMs / 1000).toFixed(1)}</td>
              <td>{stage.warmUp ? 'not judged' : (stage.bent ?? '')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {Object.keys(Object.assign({}, ...run.stages.map((stage) => stage.reasons))).length > 0 && (
        <ul className="inspect-each">
          {Object.entries(
            run.stages.reduce<Record<string, number>>((all, stage) => {
              for (const [why, count] of Object.entries(stage.reasons)) all[why] = (all[why] ?? 0) + count;
              return all;
            }, {}),
          ).map(([why, count]) => (
            <li key={why}>
              failed {count}x: {why}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
