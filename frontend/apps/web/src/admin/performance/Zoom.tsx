import { useEffect, useState } from 'react';

import { Crossing } from './Crossing';
import { Fold } from './Fold';
import { LineChart } from './LineChart';
import { lineOf, pointName } from './shaderPoints';
import type { Spent } from './startupPoints';
import { readZoomPoints } from './zoomPoints';
import type { ZoomPoint, Zoomed } from './zoomPoints';

const PLACE_COLOURS: Record<string, string> = { forest: '#8a7a1f', grassland: '#1baf7a', ice: '#2a78d6' };
const OTHER = '#555555';

type Reading =
  | { state: 'reading' }
  | { state: 'read'; points: readonly ZoomPoint[]; unreadable: number }
  | { state: 'unread'; problem: string };

const ms = (value: number) => Math.round(value).toLocaleString('en-GB');
const compiled = (zoom: Zoomed) =>
  zoom.compiles.length === 0 ? '-' : zoom.compiles.map((each) => `${each.name} ${ms(each.ms)}`).join(', ');

/**
 * How smoothly the camera comes in from far out, point by point: the history `npm run perf:zoom` keeps, read from
 * `docs/experiments/performance/zoom.jsonl`. The run's first zoom, in a browser that has compiled none of the game's
 * programs, apart; then each place's zoom - the forest thick with sprites, the grassland, the bare ice - its frames,
 * stutters and stalls, and where the CPU's time went, so that what the sprites cost a zoom is the forest's against the
 * ice's; and the crossing into the real world over the busiest ground (`Crossing.tsx`). See decision record 0106.
 */
export function Zoom() {
  const [reading, setReading] = useState<Reading>({ state: 'reading' });

  useEffect(() => {
    fetch('/performance/zoom.jsonl')
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error(`${response.status}`))))
      .then((text) => setReading({ state: 'read', ...readZoomPoints(text) }))
      .catch((problem: unknown) =>
        setReading({ state: 'unread', problem: `could not read the points: ${String(problem)}` }),
      );
  }, []);

  const points = reading.state === 'read' ? reading.points : [];
  const line = lineOf(points);
  const latest = line.at(-1);
  const places = latest?.zooms.map((zoom) => zoom.place) ?? [];

  return (
    <Fold
      title="Zooming in, crossing into the real world, and what the sprites cost"
      aside={
        <>
          from docs/experiments/performance/zoom.jsonl
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
          No point yet. One is `npm run perf:zoom --prefix frontend -- --record`.
        </p>
      )}
      {latest !== undefined && (
        <>
          <Latest point={latest} />
          <section className="inspect-group" aria-label="each zoom, point by point">
            <h3 className="inspect-group__title">Each zoom, point by point</h3>
            <p className="inspect-said">
              The milliseconds the page could do nothing else - its long tasks - while the camera came in and
              in the three seconds after; and, apart, the first zoom&apos;s, which is mostly the graphics
              driver compiling the game&apos;s programs.
            </p>
            <LineChart
              label="long tasks over a zoom, point by point"
              labels={line.map(pointName)}
              captions={line.map((point) => point.code.subject)}
              unit="ms"
              series={places.map((place) => ({
                name: place,
                colour: PLACE_COLOURS[place] ?? OTHER,
                values: line.map((point) => {
                  const zoom = point.zooms.find((each) => each.place === place);
                  return zoom === undefined
                    ? null
                    : Math.round(zoom.during.longTasks.total + zoom.after.longTasks.total);
                }),
              }))}
            />
            <LineChart
              label="the first zoom's stall, point by point"
              labels={line.map(pointName)}
              captions={line.map((point) => point.code.subject)}
              unit="s"
              series={[
                {
                  name: 'the first zoom',
                  colour: OTHER,
                  values: line.map((point) =>
                    point.firstZoom === null
                      ? null
                      : Math.round(point.firstZoom.during.longTasks.total / 100) / 10,
                  ),
                },
              ]}
            />
          </section>
          <WhereItWent zooms={latest.zooms} />
          <Crossing line={line} />
        </>
      )}
    </Fold>
  );
}

function Latest({ point }: { point: ZoomPoint }) {
  const first = point.firstZoom;
  const rows: { label: string; zoom: Zoomed }[] = [
    ...(first === null ? [] : [{ label: `${first.place}, the first zoom`, zoom: first }]),
    ...point.zooms.map((zoom) => ({ label: zoom.place, zoom })),
  ];
  return (
    <section className="inspect-group" aria-label="the latest point">
      <p className="inspect-said">
        The latest point, {pointName(point)}, &quot;{point.code.subject}&quot;, {point.why}: the camera flown
        from zoom {point.zooms[0]?.from ?? 5} to {point.zooms[0]?.to ?? 10} over{' '}
        {(point.zooms[0]?.ms ?? 4000) / 1000} s on a fresh page, the shaders as a player has them, at{' '}
        {point.machine.viewport} on the {point.machine.gpu}, {point.machine.cpu}; each place the middle of{' '}
        {point.of}. A stutter is a gap between frames of 50 ms or more.
        {first !== null &&
          first.compiles.length > 0 &&
          ` The first zoom of a browser that has compiled nothing yet stalled the page ${(first.during.longTasks.total / 1000).toFixed(1)} s, waiting on compiling ${compiled(first)} ms: what a player's first visit meets, and every visit after the shader changes.`}
      </p>
      <table className="inspect-table perf-table">
        <thead>
          <tr>
            <th>zoom</th>
            <th>sprites</th>
            <th>frames a second</th>
            <th>stutters</th>
            <th>worst gap ms</th>
            <th>95th gap ms</th>
            <th>long tasks</th>
            <th>stutters after</th>
            <th>long tasks after</th>
            <th>CPU ms</th>
            <th>waited on compiling, ms</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, zoom }) => (
            <tr key={label}>
              <td>
                <a href={`/?at=${zoom.lat},${zoom.lon}&zoom=${zoom.to}`}>{label}</a>
              </td>
              <td>{zoom.sprites === null ? '-' : ms(zoom.sprites)}</td>
              <td>{zoom.during.fps}</td>
              <td>{zoom.during.janky}</td>
              <td>{ms(zoom.during.worstGap)}</td>
              <td>{ms(zoom.during.p95Gap)}</td>
              <td>
                {zoom.during.longTasks.count}, {ms(zoom.during.longTasks.total)} ms
              </td>
              <td>{zoom.after.janky}</td>
              <td>
                {zoom.after.longTasks.count}, {ms(zoom.after.longTasks.total)} ms
              </td>
              <td>{ms(zoom.cpu.busy)}</td>
              <td>{compiled(zoom)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function WhereItWent({ zooms }: { zooms: readonly Zoomed[] }) {
  const list = (zoom: Zoomed, spent: readonly Spent[]) => (
    <table key={zoom.place} className="inspect-table perf-table">
      <thead>
        <tr>
          <th>{zoom.place}, by module</th>
          <th>ms</th>
        </tr>
      </thead>
      <tbody>
        {spent.map((each) => (
          <tr key={each.name}>
            <td>{each.name}</td>
            <td>{ms(each.ms)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <section className="inspect-group" aria-label="where the CPU's time went">
      <h3 className="inspect-group__title">Where the CPU&apos;s time went over each zoom</h3>
      <p className="inspect-said">
        Each module&apos;s own time over the zoom and the three seconds after; what the forest spends that the
        ice does not is what its sprites cost.
      </p>
      <div className="perf-side">{zooms.map((zoom) => list(zoom, zoom.modules))}</div>
    </section>
  );
}
