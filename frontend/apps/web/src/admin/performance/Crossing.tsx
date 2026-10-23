import type { ReactNode } from 'react';

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
const world = (point: ZoomPoint) =>
  point.method >= 2
    ? "the settlements' buildings standing as a player's world has them"
    : "on a world without the settlements' buildings";
const counted =
  'A late frame is a gap of 25 ms or more, a frame lost at sixty a second; a stutter is one of 50 ms or more.';

/** One of the flights over the busiest ground the zoom's measure keeps beside its zooms: the crossing, or the pan. */
interface Flown {
  name: 'crossing' | 'pan';
  title: string;
  of: (point: ZoomPoint) => Zoomed | null | undefined;
  firstOf: (point: ZoomPoint) => Zoomed | null | undefined;
  said: (point: ZoomPoint, one: Zoomed) => ReactNode;
}

const CROSSING: Flown = {
  name: 'crossing',
  title: 'Crossing into the real world',
  of: (point) => point.crossing,
  firstOf: (point) => point.firstCrossing,
  said: (point, one) =>
    `The latest point, ${pointName(point)}: the camera settled at zoom ${one.from} over ${one.place} and flown to ` +
    `${one.to} over ${one.ms / 1000} s, across 7.5, where the real world arrives, the fog lifted, ${world(point)}; ` +
    `the middle of ${point.of} by its late frames, then watched three seconds more. ${counted}`,
};

const PAN: Flown = {
  name: 'pan',
  title: 'Panning in the real world',
  of: (point) => point.pan,
  firstOf: (point) => point.firstPan,
  said: (point, one) =>
    `The latest point, ${pointName(point)}: the camera settled at zoom ${one.from} over ${one.place}, the real world ` +
    `in, and panned ${count(one.east)} pixels east over ${one.ms / 1000} s, a brisk drag, where a wood or a ` +
    `roadside laid out again is felt, the fog lifted, ${world(point)}; the middle of ${point.of} by its late ` +
    `frames, then watched three seconds more. ${counted}`,
};

/**
 * The crossing into the real world, point by point: the camera settled at zoom 7 over the busiest ground, `settled`,
 * and flown to 8.2, through the zoom where the trees, the roads and everything standing arrive at once. The latest
 * point's first crossing, which waits on whatever programs only the real world needs, and the middle of its rounds;
 * that one's slowest frames and what ran in each; and the late frames and the stutters point by point. Absent from
 * the points before 2026-10-22. See `docs/plans/smooth-crossing-into-the-real-world.md`.
 */
export function Crossing({ line }: { line: readonly ZoomPoint[] }) {
  return <Flight line={line} flown={CROSSING} />;
}

/**
 * The pan across the same ground with the real world in, as the crossing is drawn: what a roadside or a wood laid
 * out again whole costs while the camera moves, which one crossing on a fresh page hardly shows. Absent from the
 * points before 2026-10-23.
 */
export function Pan({ line }: { line: readonly ZoomPoint[] }) {
  return <Flight line={line} flown={PAN} />;
}

function Flight({ line, flown }: { line: readonly ZoomPoint[]; flown: Flown }) {
  const latest = line.findLast((point) => flown.of(point) !== undefined && flown.of(point) !== null);
  const one = latest === undefined ? null : (flown.of(latest) ?? null);
  return (
    <section className="inspect-group" aria-label={flown.title.toLowerCase()}>
      <h3 className="inspect-group__title">{flown.title}</h3>
      {latest === undefined || one === null ? (
        <p className="inspect-quiet">
          No {flown.name} measured yet. One is `npm run perf:zoom --prefix frontend -- --record`.
        </p>
      ) : (
        <>
          <p className="inspect-said">{flown.said(latest, one)}</p>
          <Table name={flown.name} first={flown.firstOf(latest) ?? null} one={one} />
          <Slowest one={one} />
        </>
      )}
      <LineChart
        label={`the ${flown.name}'s late frames and stutters, point by point`}
        labels={line.map(pointName)}
        captions={line.map((point) => point.code.subject)}
        unit=""
        series={[
          {
            name: 'late frames',
            colour: LATE,
            values: line.map((point) => {
              const each = flown.of(point);
              return each ? late(each) : null;
            }),
          },
          {
            name: 'stutters',
            colour: STUTTERS,
            values: line.map((point) => {
              const each = flown.of(point);
              return each ? each.during.janky + each.after.janky : null;
            }),
          },
        ]}
      />
    </section>
  );
}

function Table({ name, first, one }: { name: string; first: Zoomed | null; one: Zoomed }) {
  const rows = [
    ...(first === null ? [] : [{ label: `the first ${name}`, zoom: first }]),
    { label: `the ${name}`, zoom: one },
  ];
  return (
    <table className="inspect-table perf-table">
      <thead>
        <tr>
          <th>{name}</th>
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

/** A flight's slowest frames, the slowest first: when it began, how long, and the five things that ran longest. */
function Slowest({ one }: { one: Zoomed }) {
  const frames = one.slowest ?? [];
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
