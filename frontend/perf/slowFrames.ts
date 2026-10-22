import type { SlowFrame } from '../apps/web/src/admin/performance/zoomPoints.ts';
import type { Spent } from '../apps/web/src/admin/performance/startupPoints.ts';
import { moduleOf } from './startupStats.ts';
import type { Profile } from './startupStats.ts';

/**
 * What ran in each frame that came late, from a CPU profile Chrome took while the camera moved. A profile keeps its own
 * clock, which is not the page's, so the page runs a function of the name `LINE_UP` for a few milliseconds just before
 * the camera moves, and the last sample taken in it says where the page's moment fell on the profile's clock. A
 * sample's time goes to the game's own function nearest the top of its stack, with whatever it called in the
 * libraries, so a frame reads as the game's own work; to the library's name where none of the game's was running.
 */

/** A gap between frames this long or longer lost a frame at sixty a second: the frame came late. */
export const LATE_MS = 25;

/** The function the page runs just before the camera moves, by whose last sample the profile is lined up. */
export const LINE_UP = 'lineUpTheProfile';

/** A profile with what `Profiler.stop` also hands over: when it began, and each node's callees. */
export interface TimedProfile extends Profile {
  startTime: number;
  nodes: (Profile['nodes'][number] & { children?: number[] })[];
}

interface Sample {
  /** When it was taken, and how long it stood for, in microseconds of the profile's clock. */
  at: number;
  us: number;
  ran: string;
  lining: boolean;
}

/** Whether a module is the game's own, a file of its own or of a package of the workspace: TypeScript, as no library is. */
const ownModule = (module: string) => /\.tsx?$/.test(module);

function samplesOf(profile: TimedProfile): Sample[] {
  const byId = new Map(profile.nodes.map((node) => [node.id, node]));
  const parent = new Map<number, number>();
  for (const node of profile.nodes) for (const child of node.children ?? []) parent.set(child, node.id);
  const known = new Map<number, { ran: string; lining: boolean }>();
  const read = (id: number): { ran: string; lining: boolean } => {
    const already = known.get(id);
    if (already !== undefined) return already;
    let ran: string | null = null;
    let lining = false;
    for (let at: number | undefined = id; at !== undefined; at = parent.get(at)) {
      const frame = byId.get(at)!.callFrame;
      if (frame.functionName === LINE_UP) lining = true;
      const module = moduleOf(frame.url, frame.functionName);
      if (ran === null && ownModule(module)) {
        ran = `${frame.functionName || '(anonymous)'} ${module}:${frame.lineNumber + 1}`;
      }
    }
    const leaf = byId.get(id)!.callFrame;
    const result = { ran: ran ?? moduleOf(leaf.url, leaf.functionName), lining };
    known.set(id, result);
    return result;
  };
  const deltas = profile.timeDeltas ?? [];
  let at = profile.startTime;
  return (profile.samples ?? []).map((id, i) => {
    at += deltas[i] ?? 0;
    return { at, us: deltas[i + 1] ?? 0, ...read(id) };
  });
}

const round = (ms: number) => Math.round(ms * 10) / 10;

/**
 * The `most` slowest frames between `began` and `until`, on the page's clock in milliseconds, each with the `ran`
 * things that ran longest in it; none when the profile cannot be lined up with the page.
 */
export function slowestFrames(
  profile: TimedProfile,
  frames: readonly number[],
  began: number,
  until: number,
  most = 6,
  ran = 5,
): SlowFrame[] {
  const samples = samplesOf(profile);
  const lining = samples.findLast((sample) => sample.lining);
  if (lining === undefined) return [];
  const offset = lining.at + lining.us - began * 1000;
  const inside = frames.filter((frame) => frame >= began && frame <= until);
  const gaps = inside
    .slice(1)
    .map((frame, i) => ({ from: inside[i]!, to: frame }))
    .filter((gap) => gap.to - gap.from >= LATE_MS)
    .sort((a, b) => b.to - b.from - (a.to - a.from))
    .slice(0, most);
  return gaps.map((gap) => {
    const spent = new Map<string, number>();
    for (const sample of samples) {
      const at = (sample.at - offset) / 1000;
      if (at < gap.from || at >= gap.to || sample.ran === '(idle)') continue;
      spent.set(sample.ran, (spent.get(sample.ran) ?? 0) + sample.us / 1000);
    }
    const kept: Spent[] = [...spent]
      .sort((a, b) => b[1] - a[1])
      .slice(0, ran)
      .map(([name, ms]) => ({ name, ms: round(ms) }));
    return { at: round(gap.from - began), ms: round(gap.to - gap.from), ran: kept };
  });
}
