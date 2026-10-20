import { describe, expect, it } from 'vitest';

import { clientFrameSchema } from '@villages/protocol';
import type { MomentView } from '@villages/protocol';

import { SAMPLE, askedOf, seedReads, startsOf, towardSaid, tugBySecond } from './setup';

const moment = (second: number, tugAfter: number): MomentView => ({
  second,
  happening: 0,
  side: 'a',
  actor: '#1',
  what: 'pulled',
  effect: null,
  target: null,
  amount: null,
  boosted: false,
  tugDelta: 0,
  tugAfter,
  targetEffect: null,
});

describe('the challenge as the page builds it', () => {
  it('opens on a sample the wire takes', () => {
    expect(
      clientFrameSchema.safeParse({ type: 'simulateChallenge', id: 'run-1', ...askedOf(SAMPLE) }).success,
    ).toBe(true);
  });

  it('sends a seed typed as a whole number, and none when it is empty, for the server to draw one', () => {
    expect(askedOf({ ...SAMPLE, seed: '42' }).seed).toBe(42);
    expect('seed' in askedOf({ ...SAMPLE, seed: ' ' })).toBe(false);
    expect(seedReads('')).toBe(true);
    expect(seedReads('12x')).toBe(false);
    expect(seedReads('9007199254740993')).toBe(false);
  });

  it('asks for a progression drawn from a kind in place of the one written by hand', () => {
    const asked = askedOf({ ...SAMPLE, kind: 'battle' });
    expect(asked.kind).toBe('battle');
    expect('progression' in asked).toBe(false);
    expect('kind' in askedOf(SAMPLE)).toBe(false);
  });

  it('spaces the happenings as the engine does', () => {
    expect(startsOf({ seconds: 30, happenings: [['violence'], ['diplomacy'], ['reason']] })).toEqual([
      0, 10, 20,
    ]);
    expect(startsOf({ seconds: 5, happenings: [['violence'], ['diplomacy']] })).toEqual([0, 2]);
  });

  it('says a tug toward the side it favours', () => {
    expect(towardSaid(40)).toBe('+40 toward A');
    expect(towardSaid(-12.5)).toBe('+12.5 toward B');
    expect(towardSaid(0)).toBe('even');
  });

  it('reads the tug at the end of every second, carried through seconds nothing moved it', () => {
    expect(tugBySecond([moment(0, 0), moment(1, 15), moment(1, 0), moment(3, 15)], 10)).toEqual([
      0, 0, 0, 15,
    ]);
  });
});
