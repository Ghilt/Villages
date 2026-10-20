import { useEffect, useState } from 'react';

import { Fold } from './Fold';
import { LineChart } from './LineChart';
import { lineOf, pointName } from './shaderPoints';
import { PARTS, readTestsPoints } from './testsPoints';
import type { KeptPart, TestsPoint, Took } from './testsPoints';

/** A colour a part, told apart on the page's paper; the legend and the table name them too. */
const COLOURS: Record<(typeof PARTS)[number], string> = {
  backend: '#b04ac0',
  frontend: '#2a78d6',
  scripts: '#8a7a1f',
  e2e: '#eb6834',
};

type Reading =
  | { state: 'reading' }
  | { state: 'read'; points: readonly TestsPoint[]; unreadable: number }
  | { state: 'unread'; problem: string };

const seconds = (ms: number | null | undefined) =>
  ms === null || ms === undefined ? '-' : (ms / 1000).toFixed(1);
const partOf = (point: TestsPoint, name: string) => point.parts.find((part) => part.name === name);
const ran = (part: KeptPart | undefined) => (part === undefined || part.notRun !== undefined ? null : part);

/**
 * How long the tests take, point by point: the history `node scripts/check.ts --record` keeps, read from
 * `docs/experiments/performance/tests.jsonl`. The latest point's parts - the backend, the frontend, the scripts' own,
 * the end-to-end test - each with its steps and how many tests it ran; each part's time and count point by point; and
 * where the time went, the backend by module and spec, the frontend by test file and by Vitest's own account. See
 * decision record 0106.
 */
export function Tests() {
  const [reading, setReading] = useState<Reading>({ state: 'reading' });

  useEffect(() => {
    fetch('/performance/tests.jsonl')
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error(`${response.status}`))))
      .then((text) => setReading({ state: 'read', ...readTestsPoints(text) }))
      .catch((problem: unknown) =>
        setReading({ state: 'unread', problem: `could not read the points: ${String(problem)}` }),
      );
  }, []);

  const points = reading.state === 'read' ? reading.points : [];
  const line = lineOf(points);
  const latest = line.at(-1);
  const series = (value: (part: KeptPart) => number | null) =>
    PARTS.map((name) => ({
      name,
      colour: COLOURS[name],
      values: line.map((point) => {
        const part = ran(partOf(point, name));
        return part === null ? null : value(part);
      }),
    }));

  return (
    <Fold
      title="How long the tests take"
      aside={
        <>
          from docs/experiments/performance/tests.jsonl
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
        <p className="inspect-quiet">No point yet. One is `node scripts/check.ts --record`.</p>
      )}
      {latest !== undefined && (
        <>
          <Latest point={latest} />
          <section className="inspect-group" aria-label="each part, point by point">
            <h3 className="inspect-group__title">Each part, point by point</h3>
            <p className="inspect-said">
              The seconds each part took, the backend&apos;s compile left out, since what Gradle&apos;s cache
              already held decides it; and how many tests each ran. A part a commit did not have yet is left
              out of its point.
            </p>
            <LineChart
              label="the seconds each part took, point by point"
              labels={line.map(pointName)}
              captions={line.map((point) => point.code.subject)}
              unit="s"
              series={series((part) => {
                const compile = part.steps.find((step) => step.name === 'compile')?.ms ?? 0;
                return Math.round((part.ms - compile) / 100) / 10;
              })}
            />
            <LineChart
              label="the tests each part ran, point by point"
              labels={line.map(pointName)}
              captions={line.map((point) => point.code.subject)}
              unit="tests"
              series={series((part) => part.tests)}
            />
          </section>
          <WhereItWent point={latest} />
        </>
      )}
    </Fold>
  );
}

function Latest({ point }: { point: TestsPoint }) {
  return (
    <section className="inspect-group" aria-label="the latest point">
      <p className="inspect-said">
        The latest point, {pointName(point)}, &quot;{point.code.subject}&quot;, {point.why}: every check, one
        part after another, {seconds(point.ms)} s in all, on {point.machine.cpu}, {point.machine.memory}
        {point.docker ? '' : ', Docker not running, so the tests that need it were skipped'}. The
        backend&apos;s tests ran whether or not anything they test had changed, after a compile timed apart.
      </p>
      <table className="inspect-table perf-table">
        <thead>
          <tr>
            <th>part</th>
            <th>seconds</th>
            <th>its steps, seconds</th>
            <th>tests</th>
            <th>failed</th>
            <th>skipped</th>
          </tr>
        </thead>
        <tbody>
          {point.parts.map((part) => (
            <tr key={part.name}>
              <td>{part.name}</td>
              {part.notRun !== undefined ? (
                <td className="perf-table__none" colSpan={5}>
                  not run: {part.notRun}
                </td>
              ) : (
                <>
                  <td>{seconds(part.ms)}</td>
                  <td>{part.steps.map((step) => `${step.name} ${seconds(step.ms)}`).join(', ')}</td>
                  <td>{part.tests ?? '-'}</td>
                  <td>{part.failed}</td>
                  <td>{part.skipped}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function List({
  title,
  rows,
  extra,
}: {
  title: string;
  rows: readonly Took[];
  extra?: (row: Took) => string;
}) {
  if (rows.length === 0) return null;
  return (
    <table className="inspect-table perf-table">
      <thead>
        <tr>
          <th>{title}</th>
          {extra !== undefined && <th>tests</th>}
          <th>seconds</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name}>
            <td>{row.name}</td>
            {extra !== undefined && <td>{extra(row)}</td>}
            <td>{seconds(row.ms)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function WhereItWent({ point }: { point: TestsPoint }) {
  const backend = partOf(point, 'backend');
  const frontend = partOf(point, 'frontend');
  const vitest = Object.entries(frontend?.vitest ?? {})
    .filter(([stage]) => stage !== 'whole')
    .map(([name, ms]) => ({ name, ms }))
    .sort((a, b) => b.ms - a.ms);
  const modules = backend?.modules ?? [];
  return (
    <section className="inspect-group" aria-label="where the time went">
      <h3 className="inspect-group__title">Where the time went</h3>
      <p className="inspect-said">
        The backend&apos;s modules by the time their specs took, and its slowest specs; the frontend&apos;s
        slowest test files, and Vitest&apos;s own account of its time. The modules and Vitest&apos;s workers
        run side by side, so these add up to more than the part took.
      </p>
      <div className="perf-side">
        <List
          title="backend, by module"
          rows={modules}
          extra={(row) => String(modules.find((each) => each.name === row.name)?.tests ?? '-')}
        />
        <List title="backend, the slowest specs" rows={backend?.slowest ?? []} />
        <List title="frontend, the slowest files" rows={frontend?.slowest ?? []} />
        <List title="frontend, Vitest's account" rows={vitest} />
      </div>
    </section>
  );
}
