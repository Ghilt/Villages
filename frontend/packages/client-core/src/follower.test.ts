import { describe, expect, it } from 'vitest';

import type { ClientFrame } from '@villages/protocol';

import { HOLD_MS, follower } from './follower';
import type { Follower } from './follower';
import { NOTHING_ON_THE_MAP, cellsHeld } from './onTheMap';
import type { OnTheMapState } from './onTheMap';

/** The most cells the gateway lets one connection hold, past which it refuses a subscription whole. */
const MOST_CELLS = 64;

/**
 * A gateway as the follower meets it: it holds what it is asked for, refuses a subscription whole that would take
 * it past sixty-four, and answers each cell it takes, later, when the test delivers the answers.
 */
function rig() {
  let onTheMap: OnTheMapState = NOTHING_ON_THE_MAP;
  const gatewayHolds = new Set<string>();
  const answers: string[] = [];
  let refusals = 0;
  let refusing = false;
  const said: string[] = [];
  const timers: { at: number; run: () => void; cancelled: boolean }[] = [];
  let now = 0;
  let open = false;

  const following: Follower = follower({
    send: (frame: ClientFrame) => {
      if (frame.type === 'unsubscribeCells') {
        frame.cells.forEach((cell) => gatewayHolds.delete(cell));
      }
      if (frame.type === 'subscribeCells') {
        const fresh = frame.cells.filter((cell) => !gatewayHolds.has(cell));
        if (gatewayHolds.size + fresh.length > MOST_CELLS) {
          refusals++;
          refusing = true;
          return;
        }
        fresh.forEach((cell) => gatewayHolds.add(cell));
        answers.push(...fresh);
      }
    },
    canSend: () => open,
    onTheMap: () => onTheMap,
    setOnTheMap: (next) => (onTheMap = next),
    followStands: () => undefined,
    note: (area, message) => said.push(`${area}: ${message}`),
    schedule: {
      after: (ms, run) => {
        const timer = { at: now + ms, run, cancelled: false };
        timers.push(timer);
        return () => (timer.cancelled = true);
      },
    },
  });

  return {
    following,
    said,
    gatewayHolds,
    refusals: () => refusals,
    drawn: () => cellsHeld(onTheMap).sort(),
    welcome: () => {
      open = true;
      following.welcomed();
    },
    /** The gateway's answers arrive: a snapshot for each cell it took, or the refusal. */
    deliver: () => {
      if (refusing) {
        refusing = false;
        following.refused('the gateway refused tooManyCells');
      }
      for (const cell of answers.splice(0)) following.answered(cell);
    },
    /** Time passes, and whatever was waiting on it runs. */
    wait: (ms: number) => {
      now += ms;
      for (const timer of timers.splice(0)) {
        if (timer.cancelled) continue;
        if (timer.at <= now) timer.run();
        else timers.push(timer);
      }
    },
  };
}

/** A view of nine cells by five at one zoom, from a column: forty-five, as a wide zoom covers. */
const view = (zoom: number, column: number) =>
  Array.from({ length: 45 }, (_, at) => `z${zoom}:${column + (at % 9)},${Math.floor(at / 9)}`);

describe('the follower', () => {
  it('asks for nothing until the gateway is listening, and then for what the camera last wanted', () => {
    const a = rig();
    a.following.follow(view(5, 0));
    a.following.follow(view(5, 3));
    expect(a.gatewayHolds.size).toBe(0);

    a.welcome();

    expect([...a.gatewayHolds].sort()).toEqual(view(5, 3).sort());
  });

  it('pans a forty-five cell view at a wide zoom with no refusal, a column at a time', () => {
    const a = rig();
    a.welcome();
    a.following.follow(view(5, 0));
    a.deliver();

    for (let column = 1; column <= 6; column++) {
      a.following.follow(view(5, column));
      a.deliver();
    }

    expect(a.refusals()).toBe(0);
    expect(a.drawn()).toEqual(view(5, 6).sort());
  });

  it('steps a forty-five cell view to the next zoom with no refusal: the old cells are let go before it asks', () => {
    const a = rig();
    a.welcome();
    a.following.follow(view(5, 0));
    a.deliver();

    a.following.follow(view(6, 0));

    expect(a.refusals()).toBe(0);
    expect(a.gatewayHolds.size).toBe(45);
    // What is on the screen stays there until what replaces it has answered.
    expect(a.drawn()).toEqual([...view(5, 0), ...view(6, 0)].sort());
    a.deliver();
    expect(a.drawn()).toEqual(view(6, 0).sort());
    expect(a.said).toEqual(['cells: let go of 45 cells now that what replaces them has arrived']);
  });

  it('lets the old cells go after waiting, when what should replace them never answers', () => {
    const a = rig();
    a.welcome();
    a.following.follow(view(5, 0));
    a.deliver();

    a.following.follow(view(6, 0));
    a.wait(HOLD_MS - 1);
    expect(a.drawn()).toHaveLength(90);
    a.wait(1);

    expect(a.drawn()).toEqual(view(6, 0).sort());
    expect(a.said).toEqual(['cells: let go of 45 cells after waiting for what should have replaced them']);
  });

  it('after a refusal forgets what never came and asks again for what it let go, so moving back recovers', () => {
    const a = rig();
    a.welcome();
    a.following.follow(view(5, 0));
    a.deliver();
    // A view the gateway will not hold at all: more cells than it takes from one connection.
    const tooWide = Array.from({ length: 70 }, (_, at) => `z6:${at}`);

    a.following.follow(tooWide);
    a.deliver();

    expect(a.refusals()).toBe(1);
    expect(a.drawn()).toEqual(view(5, 0).sort());
    expect([...a.gatewayHolds].filter((cell) => cell.startsWith('z5')).sort()).toEqual(view(5, 0).sort());
    expect(a.said).toEqual([
      'cells: the gateway refused tooManyCells: forgot 70 that never came, asking again for 45',
    ]);
  });
});
