import { LineChart } from './LineChart';
import { pointName } from './shaderPoints';
import type { ZoomPoint, Zoomed } from './zoomPoints';

const LATE = '#eb6834';
const STUTTERS = '#555555';

const ms = (value: number) => Math.round(value).toLocaleString('en-GB');
const count = (value: number | null | undefined) => (value === null || value === undefined ? '-' : ms(value));
const late = (zoom: Zoomed) =>
  zoom.during.late === undefined ? null : zoom.during.late + (zoom.after.late ?? 0);
const compiled = (zoom: Zoomed) =>
  zoom.compiles.length === 0 ? '-' : zoom.compiles.map((each) => `${each.name} ${ms(each.ms)}`).join(', ');

/**
 * The crossing into the real world, point by point: the camera settled at zoom 7 over the busiest ground, `settled`,
 * and flown to 8.2, through the zoom where the trees, the roads and everything standing arrive at once. The latest
 * point's first crossing, which waits on whatever programs only the real world needs, and the middle of its rounds;
 * that one's slowest frames and what ran in each; and the late frames and the stutters point by point. Absent from
 * the points before 2026-10-22. See `docs/plans/smooth-crossing-into-the-real-world.md`.
 */
export function Crossing({ line }: { line: readonly ZoomPoint[] }) {
  const latest = line.findLast((point) => point.crossing !== undefined && point.crossing !== null);
  const crossing = latest?.crossing;
  return (
    <section className="inspect-group" aria-label="the crossing into the real world">
      <h3 className="inspect-group__title">Crossing into the real world</h3>
      {latest === undefined || crossing === undefined || crossing === null ? (
        <p className="inspect-quiet">
          No crossing measured yet. One is `npm run perf:zoom --prefix frontend -- --record`.
        </p>
      ) : (
        <>
          <p className="inspect-said">
            The latest point, {pointName(latest)}: the camera settled at zoom {crossing.from} over{' '}
            {crossing.place} and flown to {crossing.to} over {crossing.ms / 1000} s, across 7.5, where the
            real world arrives, the fog lifted; the middle of {latest.of} by its late frames, then watched
            three seconds more. A late frame is a gap of 25 ms or more, a frame lost at sixty a second; a
            stutter is one of 50 ms or more.
          </p>
          <Table first={latest.firstCrossing ?? null} crossing={crossing} />
          <Slowest crossing={crossing} />
        </>
      )}
      <LineChart
        label="the crossing's late frames and stutters, point by point"
        labels={line.map(pointName)}
        captions={line.map((point) => point.code.subject)}
        unit=""
        series={[
          {
            name: 'late frames',
            colour: LATE,
            values: line.map((point) => (point.crossing ? late(point.crossing) : null)),
          },
          {
            name: 'stutters',
            colour: STUTTERS,
            values: line.map((point) =>
              point.crossing ? point.crossing.during.janky + point.crossing.after.janky : null,
            ),
          },
        ]}
      />
    </section>
  );
}

function Table({ first, crossing }: { first: Zoomed | null; crossing: Zoomed }) {
  const rows = [
    ...(first === null ? [] : [{ label: 'the first crossing', zoom: first }]),
    { label: 'the crossing', zoom: crossing },
  ];
  return (
    <table className="inspect-table perf-table">
      <thead>
        <tr>
          <th>crossing</th>
          <th>trees</th>
          <th>stretches of road</th>
          <th>roadside</th>
          <th>late frames</th>
          <th>stutters</th>
          <th>worst gap ms</th>
          <th>long tasks</th>
          <th>late after</th>
          <th>long tasks after</th>
          <th>CPU ms</th>
          <th>waited on compiling, ms</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ label, zoom }) => (
          <tr key={label}>
            <td>
              <a href={`/?at=${zoom.lat},${zoom.lon}&zoom=${zoom.from}`}>{label}</a>
            </td>
            <td>{count(zoom.sprites)}</td>
            <td>{count(zoom.roads?.strips)}</td>
            <td>{count(zoom.roads?.roadside)}</td>
            <td>{count(zoom.during.late)}</td>
            <td>{zoom.during.janky}</td>
            <td>{ms(zoom.during.worstGap)}</td>
            <td>
              {zoom.during.longTasks.count}, {ms(zoom.during.longTasks.total)} ms
            </td>
            <td>{count(zoom.after.late)}</td>
            <td>
              {zoom.after.longTasks.count}, {ms(zoom.after.longTasks.total)} ms
            </td>
            <td>{ms(zoom.cpu.busy)}</td>
            <td>{compiled(zoom)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The crossing's slowest frames, the slowest first: when it began, how long, and the five things that ran longest. */
function Slowest({ crossing }: { crossing: Zoomed }) {
  const frames = crossing.slowest ?? [];
  if (frames.length === 0) return null;
  return (
    <>
      <p className="inspect-said">
        Its slowest frames, and what ran in each: the game&apos;s own function nearest the top of the stack,
        with whatever it called in the libraries, or a library&apos;s name where none of the game&apos;s was
        running.
      </p>
      <table className="inspect-table perf-table">
        <thead>
          <tr>
            <th>after the camera moved, ms</th>
            <th>the frame, ms</th>
            <th>what ran, ms</th>
          </tr>
        </thead>
        <tbody>
          {frames.map((frame) => (
            <tr key={frame.at}>
              <td>{ms(frame.at)}</td>
              <td>{ms(frame.ms)}</td>
              <td>{frame.ran.map((ran) => `${ran.name} ${ms(ran.ms)}`).join(', ') || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
