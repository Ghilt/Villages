import { describe, expect, it } from 'vitest';

import { FLIGHT, flightOf, flownAt, flyingLift, flyingSize, landingOf } from './flight';
import { FEEL, STILL, about, throwDie } from './physics';

const HAND = 44;
const LANDED = 22;
const HANG = 56;
/** Lands as big as it was held: thrown from close in. */
const CLOSE = 1;

describe('a die in flight', () => {
  it('carries further the harder it is thrown, as far as the furthest and no further', () => {
    const near = flightOf(200, 0, LANDED, STILL, FLIGHT);
    const far = flightOf(800, 0, LANDED, STILL, FLIGHT);
    const past = flightOf(99_999, 0, LANDED, STILL, FLIGHT);
    expect(far.to.x).toBeGreaterThan(near.to.x * 3.9);
    expect(past.pixels).toBe(FLIGHT.farthest);
  });

  it('is in the air longer the further it goes, as the square root of it: a flick near the ground, scaled up', () => {
    const drop = flightOf(0, 0, LANDED, STILL, FLIGHT);
    const far = flightOf(1080, 0, LANDED, STILL, FLIGHT);
    expect(drop.seconds).toBeCloseTo(FLIGHT.fallsIn, 9);
    expect(far.seconds / drop.seconds).toBeCloseTo(Math.sqrt(1 + 1080 / 120), 9);
  });

  it('rises before it falls, in one arc, higher the further it goes', () => {
    const lifts = (pixels: number) =>
      Array.from({ length: 21 }, (_, i) => flyingLift(i / 20, HANG, pixels, FLIGHT));
    const near = lifts(100);
    const far = lifts(1000);
    expect(Math.max(...near)).toBeGreaterThan(HANG);
    expect(Math.max(...far)).toBeGreaterThan(Math.max(...near) * 3);
    expect(far[far.length - 1]).toBe(0);
  });

  it('grows a little as it rises, then shrinks to its size on the ground', () => {
    const sizes = Array.from({ length: 21 }, (_, i) => flyingSize(i / 20, HAND, LANDED, FLIGHT));
    expect(Math.max(...sizes)).toBeGreaterThan(HAND);
    expect(Math.max(...sizes)).toBeLessThan(HAND * 1.25);
    expect(sizes[sizes.length - 1]).toBeCloseTo(LANDED, 9);
  });

  it('shrinks quickly just after the top of its arc and slowly near the ground', () => {
    const top = 1 / (1 + FLIGHT.landsFlat);
    const at = (falling: number) => flyingSize(top + falling * (1 - top), HAND, LANDED, FLIGHT);
    expect(at(0)).toBeGreaterThan(HAND);
    expect(at(0) - at(0.25)).toBeGreaterThan((at(0.75) - at(1)) * 3);
  });

  it('far out, shrinks to almost nothing a while before it lands, where it becomes the mark', () => {
    // Held 44 pixels wide, and 2.8 on the ground at zoom 6.5.
    const sizes = Array.from({ length: 101 }, (_, i) => flyingSize(i / 100, HAND, 2.8, FLIGHT));
    const marked = sizes.findIndex((size) => size < FLIGHT.marksBelow) / 100;
    expect(marked).toBeGreaterThan(0.7);
    expect(marked).toBeLessThan(0.95);
  });

  it('strikes the ground where its arc ends, and the physics carries it on from there', () => {
    const flight = flightOf(600, Math.PI / 4, LANDED, STILL, FLIGHT);
    const end = flownAt(flight, flight.seconds);
    expect(end.x).toBeCloseTo(flight.to.x, 9);
    expect(end.y).toBeCloseTo(flight.to.y, 9);
    const { velocity, spin, gravity } = landingOf(flight, FLIGHT, FEEL, HANG, LANDED, CLOSE);
    expect(velocity.z).toBeLessThan(0);
    const path = throwDie(
      { at: { x: 0, y: 0, z: 0.55 }, velocity, spin, turn: end.turn },
      { ...FEEL, gravity },
    );
    const last = path.frames[path.frames.length - 1]!;
    expect(path.settled).toBe(true);
    // It goes on the way it flew, bouncing.
    expect(last.at.x * flight.to.x + last.at.y * flight.to.y).toBeGreaterThan(0);
    expect(Math.max(...path.frames.map((frame) => frame.at.z))).toBeGreaterThan(1);
  });

  it('slows over the ground as it nears it, as a thing thrown away from the eye does, but never to a stop', () => {
    const flight = flightOf(800, 0, LANDED, STILL, FLIGHT);
    const at = (share: number) => flownAt(flight, flight.seconds * share).x;
    expect(at(1) - at(0.9)).toBeLessThan((at(0.1) - at(0)) / 2);
    expect(at(1) - at(0.99)).toBeGreaterThan((at(1) / 100) * flight.rollsOn * 0.95);
  });

  it('goes on over the ground as fast as it was going as it struck it, at every zoom', () => {
    const flight = flightOf(900, 0.4, LANDED, STILL, FLIGHT);
    const late = flownAt(flight, flight.seconds * (1 - 1e-7));
    const end = flownAt(flight, flight.seconds);
    const struck = (Math.hypot(end.x - late.x, end.y - late.y) * LANDED) / (flight.seconds * 1e-7);
    for (const unit of [14, 32]) {
      const { velocity } = landingOf(flight, FLIGHT, FEEL, HANG, unit, CLOSE);
      expect(Math.hypot(velocity.x, velocity.y) * unit).toBeCloseTo(struck, 0);
    }
  });

  it('comes down in a long, steady fall, with no plunge at the end', () => {
    const lift = (share: number) => flyingLift(share, HANG, 800, FLIGHT);
    const highest = Math.max(...Array.from({ length: 101 }, (_, i) => lift(i / 100)));
    expect(lift(0.5)).toBeGreaterThan(highest * 0.4);
    expect(lift(0.95) - lift(1)).toBeLessThan(highest * 0.05);
  });

  it('drops straight down onto its shadow when it is not thrown', () => {
    const flight = flightOf(0, 1, LANDED, STILL, FLIGHT);
    expect(flight.to).toEqual({ x: 0, y: 0 });
    expect(landingOf(flight, FLIGHT, FEEL, HANG, LANDED, CLOSE).velocity.x).toBe(0);
  });

  it('strikes the ground harder thrown than dropped, and a hard throw lands as a meek one does', () => {
    const strikes = (pixels: number) =>
      landingOf(flightOf(pixels, 0, LANDED, STILL, FLIGHT), FLIGHT, FEEL, HANG, 14, CLOSE).velocity;
    expect(strikes(250).z).toBeLessThan(strikes(0).z);
    expect(strikes(1500).z).toBeCloseTo(strikes(600).z, 9);
    expect(strikes(1500).x * 14).toBeCloseTo(FLIGHT.rollsAtMost, 9);
    expect(strikes(250).x * 14).toBeLessThan(FLIGHT.rollsAtMost);
  });

  it('strikes the ground harder the higher it was thrown from, so a mark far out bounces big', () => {
    const flight = flightOf(600, 0.3, LANDED, STILL, FLIGHT);
    // Held 44 pixels wide: on the ground 32 pixels close in, and 2.8, drawn as a 14 pixel mark, far out.
    const near = landingOf(flight, FLIGHT, FEEL, HANG, 32, 44 / 32);
    const far = landingOf(flight, FLIGHT, FEEL, HANG, 14, 44 / 2.8);
    expect(far.velocity.z * 14).toBeLessThan(near.velocity.z * 32 * 1.3);
    expect(Math.hypot(far.velocity.x, far.velocity.y) * 14).toBeCloseTo(
      Math.hypot(near.velocity.x, near.velocity.y) * 32,
      9,
    );
  });

  it('goes on the way it flew after it strikes, however hard it strikes from far out and however it is turned', () => {
    const flight = flightOf(600, 0, LANDED, STILL, FLIGHT);
    const { velocity, spin, gravity } = landingOf(flight, FLIGHT, FEEL, HANG, 14, 44 / 2.8);
    for (let i = 0; i < 12; i++) {
      const turn = about({ x: 1, y: 2, z: 3 }, i * 0.9);
      const path = throwDie({ at: { x: 0, y: 0, z: 0.55 }, velocity, spin, turn }, { ...FEEL, gravity });
      expect(path.frames[path.frames.length - 1]!.at.x).toBeGreaterThan(1);
    }
  });

  it('strikes the ground the same on the screen from the same height, however wide the die is drawn there', () => {
    const flight = flightOf(600, 0.3, LANDED, STILL, FLIGHT);
    const far = landingOf(flight, FLIGHT, FEEL, HANG, 14, 4);
    const near = landingOf(flight, FLIGHT, FEEL, HANG, 32, 4);
    expect(far.velocity.z * 14).toBeCloseTo(near.velocity.z * 32, 9);
    expect(far.velocity.x * 14).toBeCloseTo(near.velocity.x * 32, 9);
    expect(far.gravity * 14).toBeCloseTo(near.gravity * 32, 9);
  });
});
