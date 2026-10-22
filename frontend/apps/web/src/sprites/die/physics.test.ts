import { describe, expect, it } from 'vitest';

import { FACES, FEEL, STILL, about, faceUp, laidFlat, rotate, throwDie } from './physics';
import type { Obstacle, Start } from './physics';

/** A drop near the ground, from three die widths up: what the flight hands the physics is a die striking it. */
const DROP_FROM = 3;

const STILL_SPIN = { x: 0, y: 0, z: 0 };

function drop(turn = STILL, spin = { x: 0, y: 0, z: 0 }): Start {
  return { at: { x: 0, y: 0, z: DROP_FROM }, velocity: { x: 0, y: 0, z: 0 }, spin, turn };
}

function thrown(angle: number): Start {
  return {
    at: { x: 0, y: 0, z: 1 },
    velocity: { x: Math.cos(angle) * 40, y: Math.sin(angle) * 40, z: 12 },
    spin: { x: Math.sin(angle * 3) * 14, y: Math.cos(angle * 5) * 14, z: Math.sin(angle) * 6 },
    turn: about({ x: 1, y: 2, z: 3 }, angle),
  };
}

const ANGLES = Array.from({ length: 60 }, (_, i) => i * 2.399);

describe('a die thrown', () => {
  it('comes to rest by itself, lying on a face, every time', () => {
    for (const angle of ANGLES) {
      const path = throwDie(thrown(angle), FEEL);
      expect(path.settled).toBe(true);
      const last = path.frames[path.frames.length - 1]!;
      expect(last.at.z).toBeCloseTo(0.5, 6);
      expect(rotate(last.turn, FACES[path.up]!).z).toBeCloseTo(1, 6);
    }
  });

  it('travels a good way from where it was let go, and never sinks into the ground', () => {
    for (const angle of ANGLES) {
      const path = throwDie(thrown(angle), FEEL);
      const last = path.frames[path.frames.length - 1]!;
      expect(Math.hypot(last.at.x, last.at.y)).toBeGreaterThan(4);
      for (const frame of path.frames) expect(frame.at.z).toBeGreaterThan(0.4);
    }
  });

  it('is worked out quickly enough to do the moment it is let go', () => {
    const begun = performance.now();
    for (const angle of ANGLES) throwDie(thrown(angle), FEEL);
    expect((performance.now() - begun) / ANGLES.length).toBeLessThan(20);
  });

  it('brings every face up about as often as any other', () => {
    const ups = new Array<number>(6).fill(0);
    for (let i = 0; i < 300; i++) ups[throwDie(thrown(i * 1.7), FEEL).up]! += 1;
    for (const count of ups) expect(count).toBeGreaterThan(15);
  });
});

describe('a die dropped', () => {
  it('rests close to the point under it', () => {
    for (const angle of ANGLES) {
      const path = throwDie(
        drop(about({ x: 1, y: 1, z: 0 }, angle), { x: Math.sin(angle) * 3, y: 0, z: 1 }),
        FEEL,
      );
      const last = path.frames[path.frames.length - 1]!;
      expect(Math.hypot(last.at.x, last.at.y)).toBeLessThan(5);
    }
  });

  it('keeps the face it was dropped on when it falls flat', () => {
    expect(throwDie(drop(), FEEL).up).toBe(faceUp(STILL));
  });

  it('strikes a wall in its way and does not pass through it', () => {
    const wall: Obstacle = { kind: 'box', west: 6, east: 9, north: -20, south: 20, height: 4 };
    const start: Start = {
      at: { x: 0, y: 0, z: 1 },
      velocity: { x: 50, y: 0, z: 2 },
      spin: { x: 0, y: 0, z: 0 },
      turn: STILL,
    };
    const path = throwDie(start, FEEL, [wall]);
    for (const frame of path.frames) expect(frame.at.x).toBeLessThan(wall.east);
    expect(path.knocks.length).toBeGreaterThan(0);
  });

  it('strikes a post thinner than itself', () => {
    const post: Obstacle = { kind: 'post', x: 5, y: 0, radius: 0.2, height: 6 };
    const start: Start = {
      at: { x: 0, y: 0, z: 0.5 },
      velocity: { x: 30, y: 0, z: 0 },
      spin: { x: 0, y: 0, z: 0 },
      turn: STILL,
    };
    const path = throwDie(start, FEEL, [post]);
    expect(path.frames.every((frame) => frame.at.x < post.x)).toBe(true);
  });
});

describe('a die sliding on a face', () => {
  it('is stopped by the ground holding it, however little friction there is', () => {
    const sliding = {
      at: { x: 0, y: 0, z: 0.5 },
      velocity: { x: 6, y: 0, z: 0 },
      spin: STILL_SPIN,
      turn: STILL,
    };
    const held = throwDie(sliding, { ...FEEL, friction: 0 });
    const loose = throwDie(sliding, { ...FEEL, friction: 0, sliding: 1 });
    expect(held.settled).toBe(true);
    expect(held.frames[held.frames.length - 1]!.at.x).toBeLessThan(2);
    expect(loose.frames[loose.frames.length - 1]!.at.x).toBeGreaterThan(10);
  });
});

describe('laying a die flat', () => {
  it('turns it the least it can onto the face nearest the top', () => {
    const tipped = about({ x: 1, y: 0, z: 0 }, 0.2);
    const flat = laidFlat(tipped);
    expect(rotate(flat, FACES[4]!).z).toBeCloseTo(1, 9);
    expect(faceUp(flat)).toBe(4);
  });
});
