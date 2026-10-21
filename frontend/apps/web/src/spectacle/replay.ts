import type { ChallengeSimulatedFrame, MomentView, SliceView } from '@villages/protocol';
import { antiOf, ASPECTS } from '@villages/world';
import type { Aspect, Challenges } from '@villages/world';

/** A side of a challenge as the wire names it. */
export type SideKey = 'a' | 'b';

/** What a run carries that a replay is folded from. */
export type Run = Pick<ChallengeSimulatedFrame, 'moments' | 'summons' | 'progression' | 'outcome'>;

/** A buff or a debuff borne, by its id, and the last second it lasts through. */
export interface Bearing {
  readonly id: string;
  readonly until: number;
}

/** Something standing on the field: a summon, or a thing put on the line, which is a summon too. */
export interface OnField {
  readonly serial: number;
  /** The catalogue's kind of summon, or `onTheLine`. */
  readonly kind: string;
  readonly name: string;
  readonly side: SideKey;
  readonly aspect: Aspect | null;
  readonly arrived: number;
  /** The second it was killed; it lies there three seconds as it fades. */
  readonly fell: number | null;
  readonly onTheLine: boolean;
  /** The effect that hired it or put it on the line. */
  readonly effect: string | null;
  readonly bearing: readonly Bearing[];
}

/** Whether a slice can work in the happening going on. */
export type SliceState = 'matching' | 'answering' | 'working' | 'idle';

/** A slice as it stands in a second. */
export interface SliceNow {
  readonly side: SideKey;
  readonly index: number;
  /** As a moment names it: `a1`, the first of side A's. */
  readonly actor: string;
  readonly aspect: Aspect;
  readonly state: SliceState;
  readonly bearing: readonly Bearing[];
}

/** The happening going on, its aspects and the seconds it runs from and to. */
export interface HappeningNow {
  readonly index: number;
  readonly aspects: readonly Aspect[];
  readonly from: number;
  readonly to: number;
}

/** The field at the end of one second: everything a diorama draws of it. */
export interface Field {
  readonly second: number;
  readonly tug: number;
  readonly happening: HappeningNow;
  readonly standing: readonly OnField[];
  readonly slices: Readonly<Record<SideKey, readonly SliceNow[]>>;
  /** What each actor pulled in this second, by how a moment names it: `#3`, `a1`. */
  readonly pulled: ReadonlyMap<string, number>;
  readonly moments: readonly MomentView[];
}

/** A run folded second by second, from the first to the last it was fought. */
export interface Replay {
  readonly last: number;
  readonly fields: readonly Field[];
  /** The tug at the end of each second. */
  readonly tug: readonly number[];
  at(second: number): Field;
}

/** How long a killed summon lies on the field as it fades, in seconds. */
export const FALLEN_SECONDS = 3;

const isAspect = (name: string): name is Aspect => (ASPECTS as readonly string[]).includes(name);

/** A slice by how a moment names it, `a1`, or null for anything else. */
function sliceOf(actor: string): { side: SideKey; index: number } | null {
  const named = /^([ab])(\d+)$/.exec(actor);
  return named === null ? null : { side: named[1] as SideKey, index: Number(named[2]) - 1 };
}

/** A summon's serial by how a moment names it, `#7`, or null for anything else. */
function serialOf(actor: string | null): number | null {
  const named = actor === null ? null : /^#(\d+)$/.exec(actor);
  return named === null ? null : Number(named[1]);
}

/** The first second of each happening, as the engine has it: an even share of the seconds each. */
export function startsOf(progression: Run['progression']): number[] {
  return progression.happenings.map((_, index) =>
    Math.floor((index * progression.seconds) / progression.happenings.length),
  );
}

/** The last second a run was fought: where it was pulled to an end, or its last when time ran out. */
export function lastOf(run: Run): number {
  return run.outcome.second;
}

/**
 * Folds a run into the field second by second, as a walk that is stepped a second at a time from the first: who stands
 * there, what each bears and until when, each slice's state, the tug and what each pulled. Pure: the same moments give
 * the same field, however far it was walked.
 */
function walker(run: Run, sides: Readonly<Record<SideKey, readonly SliceView[]>>, content: Challenges) {
  const effects = new Map(content.effects.map((effect) => [effect.id, effect]));
  const summonKinds = new Map(content.summons.map((summon) => [summon.id, summon]));
  const seen = new Map(run.summons.map((summon) => [summon.serial, summon]));
  const starts = startsOf(run.progression);
  const field = new Map<number, OnField>();
  const sliceBearing = new Map<string, Bearing[]>();
  let held = new Set<string>();
  let tug = 0;
  let next = 0;

  const kindOf = (serial: number) => {
    const named = seen.get(serial);
    if (named === undefined) {
      throw new Error(`the run names no summon #${serial}`);
    }
    return named;
  };
  const bear = (target: string, id: string, until: number) => {
    const serial = serialOf(target);
    if (serial !== null) {
      const one = field.get(serial);
      if (one !== undefined) {
        field.set(serial, { ...one, bearing: [...one.bearing.filter((b) => b.id !== id), { id, until }] });
      }
      return;
    }
    if (sliceOf(target) !== null) {
      sliceBearing.set(target, [
        ...(sliceBearing.get(target) ?? []).filter((b) => b.id !== id),
        { id, until },
      ]);
    }
  };
  const lift = (target: string, keep: (bearing: Bearing) => boolean) => {
    const serial = serialOf(target);
    if (serial !== null) {
      const one = field.get(serial);
      if (one !== undefined) {
        field.set(serial, { ...one, bearing: one.bearing.filter(keep) });
      }
      return;
    }
    sliceBearing.set(target, (sliceBearing.get(target) ?? []).filter(keep));
  };
  const isDebuff = (id: string) => content.debuffs.some((debuff) => debuff.id === id);

  const apply = (moment: MomentView) => {
    const s = moment.second;
    switch (moment.what) {
      case 'happeningBegan':
        held = new Set();
        break;
      case 'matches':
        held.add(moment.actor);
        break;
      case 'summoned': {
        const serial = serialOf(moment.target);
        const slice = sliceOf(moment.actor);
        if (serial === null || slice === null) break;
        const named = kindOf(serial);
        const kind = summonKinds.get(named.kind);
        field.set(serial, {
          serial,
          kind: named.kind,
          name: named.called ?? kind?.name ?? named.kind,
          side: slice.side,
          aspect: kind?.aspect ?? null,
          arrived: s,
          fell: null,
          onTheLine: false,
          effect: moment.effect,
          bearing: [],
        });
        break;
      }
      case 'arrived': {
        const serial = serialOf(moment.actor);
        if (serial === null || moment.side === null) break;
        const named = kindOf(serial);
        const effect = moment.effect === null ? undefined : effects.get(moment.effect);
        field.set(serial, {
          serial,
          kind: named.kind,
          name: named.called ?? 'a thing on the line',
          side: moment.side,
          aspect: effect?.aspect ?? null,
          arrived: s,
          fell: null,
          onTheLine: true,
          effect: moment.effect,
          bearing: [],
        });
        break;
      }
      case 'killed': {
        const serial = serialOf(moment.target);
        const one = serial === null ? undefined : field.get(serial);
        if (one !== undefined && serial !== null) field.set(serial, { ...one, fell: s, bearing: [] });
        break;
      }
      case 'turned': {
        const serial = serialOf(moment.target);
        const one = serial === null ? undefined : field.get(serial);
        if (one !== undefined && serial !== null && moment.side !== null)
          field.set(serial, { ...one, side: moment.side });
        break;
      }
      case 'deserted': {
        const serial = serialOf(moment.target);
        if (serial !== null) field.delete(serial);
        break;
      }
      case 'buffed':
      case 'debuffed':
        if (moment.target !== null && moment.status !== null)
          bear(moment.target, moment.status, s + (moment.amount ?? 0));
        break;
      case 'lifted':
        if (moment.status !== null) {
          const id = moment.status;
          lift(moment.actor, (bearing) => bearing.id !== id);
        }
        break;
      case 'cleansed':
        if (moment.target !== null) {
          const id = moment.status;
          lift(moment.target, (bearing) => (id === null ? !isDebuff(bearing.id) : bearing.id !== id));
        }
        break;
      default:
        break;
    }
  };

  const happeningAt = (second: number): HappeningNow => {
    let index = 0;
    starts.forEach((start, at) => {
      if (start <= second) index = at;
    });
    const aspects = (run.progression.happenings[index] ?? []).filter(isAspect);
    return { index, aspects, from: starts[index] ?? 0, to: starts[index + 1] ?? run.progression.seconds };
  };

  const sliceNow = (side: SideKey, happening: HappeningNow, second: number): SliceNow[] =>
    sides[side].map((slice, index) => {
      const actor = `${side}${index + 1}`;
      const aspect = isAspect(slice.aspect) ? slice.aspect : 'violence';
      const needs = slice.effects.map((id) => effects.get(id)?.needs ?? null);
      const state: SliceState =
        happening.aspects.includes(aspect) || held.has(actor)
          ? 'matching'
          : happening.aspects.includes(antiOf(aspect)) && needs.includes('anti')
            ? 'answering'
            : needs.includes(null)
              ? 'working'
              : 'idle';
      const bearing = (sliceBearing.get(actor) ?? []).filter((b) => b.until >= second);
      return { side, index, actor, aspect, state, bearing };
    });

  return (second: number): Field => {
    const moments: MomentView[] = [];
    while (next < run.moments.length && run.moments[next]!.second <= second) {
      const moment = run.moments[next]!;
      apply(moment);
      tug = moment.tugAfter;
      if (moment.second === second) moments.push(moment);
      next += 1;
    }
    for (const [serial, one] of field) {
      if (one.fell !== null && second >= one.fell + FALLEN_SECONDS) {
        field.delete(serial);
      } else if (one.bearing.some((b) => b.until < second)) {
        field.set(serial, { ...one, bearing: one.bearing.filter((b) => b.until >= second) });
      }
    }
    const pulled = new Map<string, number>();
    for (const moment of moments) {
      if (moment.tugDelta !== 0) pulled.set(moment.actor, (pulled.get(moment.actor) ?? 0) + moment.tugDelta);
    }
    const happening = happeningAt(second);
    return {
      second,
      tug,
      happening,
      standing: [...field.values()].sort((one, other) => one.serial - other.serial),
      slices: { a: sliceNow('a', happening, second), b: sliceNow('b', happening, second) },
      pulled,
      moments,
    };
  };
}

/** The field at one second, folded from nothing: what a replay must agree with however it got there. */
export function foldTo(
  run: Run,
  sides: Readonly<Record<SideKey, readonly SliceView[]>>,
  content: Challenges,
  second: number,
): Field {
  const step = walker(run, sides, content);
  let field = step(0);
  for (let at = 1; at <= second; at += 1) {
    field = step(at);
  }
  return field;
}

/** A run folded into its fields, one a second from the first to the last it was fought, read back by the second. */
export function replayOf(
  run: Run,
  sides: Readonly<Record<SideKey, readonly SliceView[]>>,
  content: Challenges,
): Replay {
  const last = lastOf(run);
  const step = walker(run, sides, content);
  const fields: Field[] = [];
  for (let at = 0; at <= last; at += 1) {
    fields.push(step(at));
  }
  return {
    last,
    fields,
    tug: fields.map((field) => field.tug),
    at: (second) => fields[Math.max(0, Math.min(last, Math.round(second)))]!,
  };
}
