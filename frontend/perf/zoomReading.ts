import type { ZoomPoint, Zoomed } from '../apps/web/src/admin/performance/zoomPoints.ts';
import type { Beside } from './compare.ts';

/**
 * What a run of the zoom's measure comes to (`zoom.ts`): the middle of a place's zooms and of the crossings, a flight
 * said in a line or two, and the numbers it is put beside the last point kept by.
 */

/**
 * The numbers of a zoom a run is put beside the last point by: the first zoom's stall, each place's stalls, stutters
 * and CPU, and the crossing's, with its late frames.
 */
export function zoomBeside(then: ZoomPoint, now: ZoomPoint): Beside[] {
  const stalled = (zoom: Zoomed | undefined | null) =>
    zoom === undefined || zoom === null ? null : zoom.during.longTasks.total + zoom.after.longTasks.total;
  const janky = (zoom: Zoomed | undefined | null) =>
    zoom === undefined || zoom === null ? null : zoom.during.janky + zoom.after.janky;
  const late = (zoom: Zoomed | undefined | null) =>
    zoom?.during.late === undefined || zoom.after.late === undefined
      ? null
      : zoom.during.late + zoom.after.late;
  /** A flight's lines - the crossing's, the pan's - its first's stall, then its late frames, stutters, stalls and CPU. */
  const flight = (
    name: string,
    thenFirst: Zoomed | null | undefined,
    nowFirst: Zoomed | null | undefined,
    thenOne: Zoomed | null | undefined,
    nowOne: Zoomed | null | undefined,
  ): Beside[] =>
    nowOne === undefined || nowOne === null
      ? []
      : [
          {
            name: `the first ${name}: long tasks`,
            then: stalled(thenFirst),
            now: stalled(nowFirst),
            least: 100,
            unit: 'ms',
          },
          { name: `the ${name}: late frames`, then: late(thenOne), now: late(nowOne), least: 3, unit: '' },
          { name: `the ${name}: stutters`, then: janky(thenOne), now: janky(nowOne), least: 2, unit: '' },
          {
            name: `the ${name}: long tasks`,
            then: stalled(thenOne),
            now: stalled(nowOne),
            least: 100,
            unit: 'ms',
          },
          {
            name: `the ${name}: CPU`,
            then: thenOne?.cpu.busy ?? null,
            now: nowOne.cpu.busy,
            least: 200,
            unit: 'ms',
          },
        ];
  const crossing = [
    ...flight('crossing', then.firstCrossing, now.firstCrossing, then.crossing, now.crossing),
    ...flight('pan', then.firstPan, now.firstPan, then.pan, now.pan),
  ];
  const first: Beside = {
    name: 'the first zoom: long tasks',
    then: stalled(then.firstZoom),
    now: stalled(now.firstZoom),
    // Nothing the first zoom needs is compiled while it waits since the land's programs are compiled ahead, so a
    // second more is a program waited on again; it swung from 23 to 31 seconds when the land's was (experiment 0025).
    least: 1_000,
    unit: 's',
  };
  return [
    ...(now.firstZoom === null ? [] : [first]),
    ...now.zooms.flatMap((zoom) => {
      const was = then.zooms.find((each) => each.place === zoom.place);
      return [
        { name: `${zoom.place}: long tasks`, then: stalled(was), now: stalled(zoom), least: 100, unit: 'ms' },
        { name: `${zoom.place}: stutters`, then: janky(was), now: janky(zoom), least: 2, unit: '' },
        {
          name: `${zoom.place}: CPU`,
          then: was?.cpu.busy ?? null,
          now: zoom.cpu.busy,
          least: 200,
          unit: 'ms',
        },
      ];
    }),
    ...crossing,
  ];
}

/** Of a place's zooms, the middle by how long the page was stalled while the camera came in. */
export function middleZoom(zooms: readonly Zoomed[]): Zoomed {
  const sorted = [...zooms].sort((a, b) => a.during.longTasks.total - b.during.longTasks.total);
  return sorted[Math.floor((sorted.length - 1) / 2)]!;
}

/** Of the crossings, or of the pans, the middle by how many frames came late over it and the seconds after. */
export function middleByLate(crossings: readonly Zoomed[]): Zoomed {
  const late = (zoom: Zoomed) => (zoom.during.late ?? 0) + (zoom.after.late ?? 0);
  const sorted = [...crossings].sort((a, b) => late(a) - late(b));
  return sorted[Math.floor((sorted.length - 1) / 2)]!;
}

/** The slowest frames of a flight, a line each: when, how long, and what ran in it. */
export const slowestSaid = (zoom: Zoomed) =>
  (zoom.slowest ?? [])
    .map(
      (frame) =>
        `           +${Math.round(frame.at)} ms, ${Math.round(frame.ms)} ms: ` +
        frame.ran.map((ran) => `${ran.name} ${Math.round(ran.ms)}`).join(', '),
    )
    .join('\n');

export const said = (zoom: Zoomed) =>
  `${zoom.place.padEnd(10)} during: ${zoom.during.fps} frames a second, ${zoom.during.late ?? '-'} late, ` +
  `${zoom.during.janky} stutters, worst gap ` +
  `${Math.round(zoom.during.worstGap)} ms, 95th ${Math.round(zoom.during.p95Gap)} ms, ${zoom.during.longTasks.count} long tasks ` +
  `${Math.round(zoom.during.longTasks.total)} ms; after: ${zoom.after.late ?? '-'} late, ${zoom.after.janky} stutters, ` +
  `${zoom.after.longTasks.count} long tasks ${Math.round(zoom.after.longTasks.total)} ms; CPU ${Math.round(zoom.cpu.busy)} ms; ` +
  `${zoom.sprites ?? '-'} sprites${zoom.roads == null ? '' : `, ${zoom.roads.strips} stretches of road, ${zoom.roads.roadside} of roadside`}` +
  `${zoom.compiles.length === 0 ? '' : `; waited on compiling ${zoom.compiles.map((compile) => `${compile.name} ${compile.ms} ms`).join(', ')}`}\n` +
  `           ${zoom.modules
    .slice(0, 6)
    .map((module) => `${module.name} ${Math.round(module.ms)}`)
    .join(', ')}`;
