import { describe, expect, it } from 'vitest';

import {
  PANEL_WANTS,
  PHONE,
  PHONE_TURNED,
  STAGE_LEAST,
  stageBox,
  stageFromSideGrip,
  stageFromTopGrip,
} from './stageBox';

const DESKTOP = { width: 1920, height: 1080 };

/** Where the middle of the stage falls, which is the number that must not move while dragging. */
function centre(box: ReturnType<typeof stageBox>): number {
  return box.blank + box.stage.w / 2;
}

describe('stageBox', () => {
  it('fills the window beside a panel at the width it wants', () => {
    const box = stageBox(DESKTOP, 'fill', false);

    expect(box.panel).toBe(PANEL_WANTS);
    expect(box.blank).toBe(0);
    expect(box.inset).toBe(0);
    expect(box.stage).toEqual({ w: 1920 - PANEL_WANTS, h: 1080 });
  });

  it('gives the whole window to the stage once the panel is a badge', () => {
    const box = stageBox(DESKTOP, 'fill', true);

    expect(box).toEqual({ blank: 0, stage: { w: 1920, h: 1080 }, panel: 0, inset: 0 });
  });

  it('mirrors every pixel the panel is dragged past its wanted width', () => {
    const box = stageBox(DESKTOP, { w: 1000, h: 1080 }, false);

    expect(box.panel).toBe((1920 - 1000 + PANEL_WANTS) / 2);
    expect(box.blank).toBe(box.panel - PANEL_WANTS);
  });

  // The property the whole feel rests on: dragging narrows the stage in place rather than sliding it
  // sideways, so a layout can be watched as it gives way instead of being chased across the screen.
  it('narrows the stage about a centre that does not move', () => {
    const wide = stageBox(DESKTOP, 'fill', false);
    const narrower = stageBox(DESKTOP, { w: 1200, h: 1080 }, false);
    const narrowest = stageBox(DESKTOP, { w: PHONE.w, h: 1080 }, false);

    expect(centre(narrower)).toBeCloseTo(centre(wide), 10);
    expect(centre(narrowest)).toBeCloseTo(centre(wide), 10);
  });

  it('shrinks the stage from the top and the bottom at once', () => {
    const box = stageBox(DESKTOP, { w: 1568, h: 800 }, false);

    expect(box.inset).toBe(140);
    expect(box.inset * 2 + box.stage.h).toBe(DESKTOP.height);
  });

  it('confines the stage to a phone', () => {
    const box = stageBox(DESKTOP, 'phone', false);

    expect(box.stage).toEqual(PHONE);
    // The panel is allowed to balloon: the room has to go somewhere, and a long log line wants it.
    expect(box.panel).toBeGreaterThan(PANEL_WANTS);
  });

  // With nothing beside it to be pushed away from, the stage sits in the middle rather than against an
  // edge: this is the view Adam minimises for, so it should read as a phone held up, not as a mistake.
  it('centres a phone-shaped stage once the panel is a badge', () => {
    const box = stageBox(DESKTOP, 'phone', true);

    expect(box.stage).toEqual(PHONE);
    expect(box.blank).toBe(box.panel);
    expect(box.blank + box.stage.w / 2).toBe(DESKTOP.width / 2);
  });

  it('takes the height it can get on a window shorter than a phone', () => {
    const box = stageBox({ width: 1920, height: 700 }, 'phone', false);

    expect(box.stage).toEqual({ w: PHONE.w, h: 700 });
    expect(box.inset).toBe(0);
  });

  it('never shrinks the stage below the narrowest thing worth looking at', () => {
    const box = stageBox(DESKTOP, { w: 40, h: 40 }, false);

    expect(box.stage).toEqual(STAGE_LEAST);
  });

  it('always divides the window exactly, whatever it is asked for', () => {
    const windows = [DESKTOP, { width: 1280, height: 800 }, { width: 600, height: 900 }];
    const modes = ['fill', 'phone', { w: 900, h: 600 }, { w: 40, h: 40 }] as const;

    for (const window of windows) {
      for (const mode of modes) {
        for (const shut of [false, true]) {
          const box = stageBox(window, mode, shut);
          const why = `${window.width}x${window.height} ${JSON.stringify(mode)} shut=${shut}`;

          expect(box.blank + box.stage.w + box.panel, why).toBeCloseTo(window.width, 10);
          expect(box.inset * 2 + box.stage.h, why).toBeCloseTo(window.height, 10);
          expect(box.blank, why).toBeGreaterThanOrEqual(0);
          expect(box.panel, why).toBeGreaterThanOrEqual(0);
          expect(box.inset, why).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

describe('the grips', () => {
  // The grip is on the boundary, so the stage loses twice what the pointer travelled - and reading the
  // width back off the boundary is what keeps the grip under the finger rather than drifting away.
  it('keeps the side grip under the pointer', () => {
    for (const at of [1568, 1400, 1200, 1000, 950]) {
      const asked = stageFromSideGrip(DESKTOP, at, 1080);
      const box = stageBox(DESKTOP, asked, false);

      expect(box.blank + box.stage.w, `grip at ${at}`).toBeCloseTo(at, 10);
    }
  });

  it('keeps the top grip under the pointer', () => {
    for (const at of [0, 100, 300]) {
      const asked = stageFromTopGrip(DESKTOP, at, 1568);
      const box = stageBox(DESKTOP, asked, false);

      expect(box.inset, `grip at ${at}`).toBeCloseTo(at, 10);
    }
  });

  // Dragged far enough the stage would vanish, so it stops and the grip carries on without it. Note
  // which way closes it: the side grip narrows the stage as it moves left, towards the blank.
  it('stops the stage at its floor rather than closing it', () => {
    expect(stageFromSideGrip(DESKTOP, 10, 1080).w).toBe(STAGE_LEAST.w);
    expect(stageFromSideGrip(DESKTOP, 900, 1080).w).toBe(STAGE_LEAST.w);
    expect(stageFromTopGrip(DESKTOP, 1070, 1568).h).toBe(STAGE_LEAST.h);
  });

  // Dragged outwards it stops where `fill` already is. Wanting the whole window is what the badge is
  // for, so the grip is never the thing that squeezes the panel out of usefulness.
  it('will not drag the panel narrower than the width it wants', () => {
    expect(stageFromSideGrip(DESKTOP, 1910, 1080).w).toBe(DESKTOP.width - PANEL_WANTS);
    expect(stageFromSideGrip(DESKTOP, 1700, 1080).w).toBe(DESKTOP.width - PANEL_WANTS);
  });
});

/**
 * The phone on its side, which is the shape that cuts the stage into a left and a right.
 *
 * A second named shape rather than a rotate, because it is checked *against* the upright one. See
 * `DebugPanel`'s two toggles.
 */
describe('the turned phone', () => {
  it('is the phone with its sides swapped', () => {
    expect(PHONE_TURNED).toEqual({ w: PHONE.h, h: PHONE.w });
  });

  it('confines the stage to it, whatever the window is', () => {
    const box = stageBox({ width: 1920, height: 1080 }, 'turned', false);

    expect(box.stage).toEqual(PHONE_TURNED);
  });

  // The whole point of it: the longer side is now the width, so the bays are cut into columns.
  it('is landscape, so its longer side is the one that gets divided', () => {
    expect(PHONE_TURNED.w).toBeGreaterThan(PHONE_TURNED.h);
  });
});
