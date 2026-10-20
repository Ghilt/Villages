import { describe, expect, it } from 'vitest';

import { clientFrameSchema } from '@villages/protocol';

import { SAMPLE, towardSaid } from './setup';

describe('the sample challenge', () => {
  it('is a frame the wire takes', () => {
    expect(clientFrameSchema.safeParse({ type: 'simulateChallenge', id: 'run-1', ...SAMPLE }).success).toBe(
      true,
    );
  });

  it('says a tug toward the side it favours', () => {
    expect(towardSaid(40)).toBe('+40 toward A');
    expect(towardSaid(-12.5)).toBe('+12.5 toward B');
    expect(towardSaid(0)).toBe('even');
  });
});
