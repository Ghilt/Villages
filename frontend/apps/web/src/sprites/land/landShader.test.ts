import { describe, expect, it } from 'vitest';

import { CHANNELS_IN_FIRST, DRAWN, channelOf } from './landMask';
import { LAND_PASSES } from './landShader';

/** What only one motion's part of the shader holds, by the motion. */
const OWN: Record<(typeof DRAWN)[number], string> = {
  grass: 'vec4 grassHere(',
  crops: 'vec4 cropsHere(',
  heath: 'vec4 heathHere(',
  wet: 'vec4 wetHere(',
  'ice-salt-sand': 'vec4 iceHere(',
};

describe('the land in passes', () => {
  it('lays the motions one over another in the order of the mask, as the one program did', () => {
    expect(LAND_PASSES.map((pass) => pass.motion)).toEqual([...DRAWN]);
  });

  it("gives each pass its own motion's code and none of another's, which is what keeps each program quick to compile", () => {
    for (const { motion, fragment } of LAND_PASSES) {
      for (const other of DRAWN) {
        expect(fragment.includes(OWN[other]), `${motion}'s pass holding ${other}'s code`).toBe(
          other === motion,
        );
      }
    }
    expect(LAND_PASSES.find((pass) => pass.motion === 'grass')!.fragment).not.toContain('duneSeen');
  });

  it("weighs each pass by its own motion's channel of the mask", () => {
    for (const { motion, fragment } of LAND_PASSES) {
      const channel = channelOf(motion)!;
      const own =
        channel < CHANNELS_IN_FIRST
          ? `softenedIn(uMask, world)[${channel}]`
          : 'softenedIn(uMaskMore, world).r';
      expect(fragment).toContain(`float amount = ${own} * uFade;`);
    }
  });
});
