import { useEffect, useState } from 'react';

import { Fold } from './Fold';
import { LineChart } from './LineChart';
import { lineOf, pointName } from './shaderPoints';
import { LOADS, readStartupPoints } from './startupPoints';
import type { Load, Spent, StartupPoint } from './startupPoints';

const COLOURS = { first: '#eb6834', again: '#2a78d6', built: '#1baf7a' } as const;

type Reading =
  | { state: 'reading' }
  | { state: 'read'; points: readonly StartupPoint[]; unreadable: number }
  | { state: 'unread'; problem: string };

const seconds = (ms: number | null | undefined) =>
  ms === null || ms === undefined ? '-' : (ms / 1000).toFixed(1);
const mb = (kb: number | undefined) => (kb === undefined ? '-' : (kb / 1024).toFixed(1));

/**
 * How long the game takes to start, point by point: the history `npm run perf:startup` keeps, read from
 * `docs/experiments/performance/startup.jsonl`. The latest point's three loads - the first after the dev server
 * started, a load again, the built page - and when each mark of the start came, the stalls and stutters up to the
 * loading screen lifting and after it, what was fetched; each load's start point by point; and where the CPU's time
 * went, by module and by function. See decision record 0106.
 */
export function Startup() {
  const [reading, setReading] = useState<Reading>({ state: 'reading' });

  useEffect(() => {
    fetch('/performance/startup.jsonl')
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error(`${response.status}`))))
      .then((text) => setReading({ state: 'read', ...readStartupPoints(text) }))
      .catch((problem: unknown) =>
        setReading({ state: 'unread', problem: `could not read the points: ${String(problem)}` }),
      );
  }, []);

  const points = reading.state === 'read' ? reading.points : [];
  const line = lineOf(points);
  const latest = line.at(-1);

  return (
    <Fold
      title="How long the game takes to start"
      aside={
        <>
          from docs/experiments/performance/startup.jsonl
          {reading.state === 'read' && `, ${points.length} ${points.length === 1 ? 'point' : 'points'}`}
          {points.length > line.length && `, ${points.length - line.length} measured otherwise and not drawn`}
          {reading.state === 'read' &&
            reading.unreadable > 0 &&
            `, ${reading.unreadable} lines that are not points`}
        </>
      }
    >
      {reading.state === 'reading' && <p className="inspect-quiet">reading the points</p>}
      {reading.state === 'unread' && <p className="inspect-problem">{reading.problem}</p>}
      {reading.state === 'read' && latest === undefined && (
        <p className="inspect-quiet">
          No point yet. One is `npm run perf:startup --prefix frontend -- --record`.
        </p>
      )}
      {latest !== undefined && (
        <>
          <Latest point={latest} />
          <section className="inspect-group" aria-label="each load, point by point">
            <h3 className="inspect-group__title">Each load, point by point</h3>
            <p className="inspect-said">
              Seconds from asking for the page to the loading screen lifting; before there was a screen, to
              the map drawn.
            </p>
            <LineChart
              label="seconds to start, point by point"
              labels={line.map(pointName)}
              captions={line.map((point) => point.code.subject)}
              unit="s"
              series={LOADS.map((load) => ({
                name: load.words,
                colour: COLOURS[load.key],
                values: line.map((point) => {
                  const ready = point.loads[load.key]?.ready;
                  return ready === null || ready === undefined ? null : Math.round(ready / 100) / 10;
                }),
              }))}
            />
            <p className="inspect-said">
              The milliseconds the page could do nothing else, long tasks, in the five seconds after the
              screen lifts, when a player is already looking.
            </p>
            <LineChart
              label="long tasks after the start, point by point"
              labels={line.map(pointName)}
              captions={line.map((point) => point.code.subject)}
              unit="ms"
              series={LOADS.map((load) => ({
                name: load.words,
                colour: COLOURS[load.key],
                values: line.map((point) => point.loads[load.key]?.after.longTasks.total ?? null),
              }))}
            />
          </section>
          {latest.loads.again !== null && <WhereItWent load={latest.loads.again} />}
        </>
      )}
    </Fold>
  );
}

function Latest({ point }: { point: StartupPoint }) {
  return (
    <section className="inspect-group" aria-label="the latest point">
      <p className="inspect-said">
        The latest point, {pointName(point)}, &quot;{point.code.subject}&quot;, {point.why}: each load in a
        browser of its own with nothing cached, at {point.machine.viewport} on the {point.machine.gpu},{' '}
        {point.machine.cpu}; the load again and the built page the middle of {point.of}. Seconds from asking
        for the page; long tasks and stutters (gaps between frames of 50 ms or more) up to the screen lifting,
        and in the five seconds after.
      </p>
      <table className="inspect-table perf-table">
        <thead>
          <tr>
            <th>load</th>
            <th>ready s</th>
            <th title="the map's style loaded, from the page opening">style</th>
            <th title="the sprite canvas made">sprites</th>
            <th>long tasks before</th>
            <th>worst gap before ms</th>
            <th>long tasks after</th>
            <th>stutters after</th>
            <th>worst gap after ms</th>
            <th>code fetched</th>
            <th>tiles fetched</th>
            <th>CPU busy before ms</th>
            <th>waited on compiling, ms</th>
          </tr>
        </thead>
        <tbody>
          {LOADS.map(({ key, words, what }) => {
            const load = point.loads[key];
            if (load === null) {
              return (
                <tr key={key}>
                  <td title={what}>{words}</td>
                  <td colSpan={12} className="perf-table__none">
                    not measured
                  </td>
                </tr>
              );
            }
            return (
              <tr key={key}>
                <td title={what}>
                  {words}
                  {load.reloads > 0 ? ` (${load.reloads} reload${load.reloads > 1 ? 's' : ''})` : ''}
                </td>
                <td>
                  {seconds(load.ready)}
                  {load.readyBy === 'drawn' ? ' (map drawn)' : ''}
                </td>
                <td>{seconds(load.at['style'])}</td>
                <td>{seconds(load.at['sprites'])}</td>
                <td>
                  {load.before.longTasks.count}, {Math.round(load.before.longTasks.total)} ms
                </td>
                <td>{Math.round(load.before.worstGap)}</td>
                <td>
                  {load.after.longTasks.count}, {Math.round(load.after.longTasks.total)} ms
                </td>
                <td>{load.after.janky}</td>
                <td>{Math.round(load.after.worstGap)}</td>
                <td>
                  {load.requests['code']?.count ?? 0}, {mb(load.requests['code']?.kb)} MB
                </td>
                <td>
                  {load.requests['tiles']?.count ?? 0}, {mb(load.requests['tiles']?.kb)} MB
                </td>
                <td>{Math.round(load.cpu.busy)}</td>
                <td>{(load.compiles ?? []).map((each) => `${each.name} ${each.ms}`).join(', ') || '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function WhereItWent({ load }: { load: Load }) {
  const list = (title: string, spent: readonly Spent[]) => (
    <table className="inspect-table perf-table">
      <thead>
        <tr>
          <th>{title}</th>
          <th>ms</th>
        </tr>
      </thead>
      <tbody>
        {spent.map((each) => (
          <tr key={each.name}>
            <td>{each.name}</td>
            <td>{Math.round(each.ms)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <section className="inspect-group" aria-label="where the CPU's time went">
      <h3 className="inspect-group__title">Where the CPU&apos;s time went, the load again</h3>
      <p className="inspect-said">
        Up to the screen lifting, {Math.round(load.cpu.busy)} ms busy ({Math.round(load.cpu.gc)} of it
        collecting garbage) and {Math.round(load.cpu.idle)} ms idle, waiting on what was fetched; each
        module&apos;s and each function&apos;s own time, not what it called.
      </p>
      <div className="perf-side">
        {list('module, up to ready', load.modules)}
        {list('function, up to ready', load.functions)}
      </div>
      <div className="perf-side">
        {list('module, the five seconds after', load.afterModules)}
        {list('function, the five seconds after', load.afterFunctions)}
      </div>
    </section>
  );
}
