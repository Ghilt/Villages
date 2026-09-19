import { describe, expect, it } from 'vitest';

import { type Asking, FOLDS_UNDER, PANE_LEAST, paneLayout } from './paneBox';

/** The stage the phone toggle makes, which is the shape the whole two-pane form exists for. */
const PHONE = { w: 390, h: 844 };
/** A stage with the debug panel at the width it wants on a 1920 monitor. */
const SPREAD = { w: 1568, h: 1080 };

const BIG: Asking = 'big';
const SMALL: Asking = { small: 120 };
const STRIP: Asking = { small: 44 };

describe('paneLayout', () => {
  describe('which form', () => {
    it('is the spread while the shorter side has room to spare', () => {
      expect(paneLayout(SPREAD, [BIG, SMALL]).form).toBe('spread');
    });

    it('folds once the shorter side reaches the number, and not one pixel before', () => {
      expect(paneLayout({ w: FOLDS_UNDER + 1, h: 2000 }, [BIG, SMALL]).form).toBe('spread');
      expect(paneLayout({ w: FOLDS_UNDER, h: 2000 }, [BIG, SMALL]).form).toBe('panes');
    });

    // A short wide window folds for the same reason a narrow tall one does: the side that ran out is the
    // short one, whichever side that happens to be.
    it('reads the shorter side whichever side it is', () => {
      expect(paneLayout({ w: 2000, h: FOLDS_UNDER }, [BIG, SMALL]).form).toBe('panes');
    });

    it('gives the whole stage to one box in the spread', () => {
      const box = paneLayout(SPREAD, [BIG, SMALL]);

      // SPREAD is landscape, so the side that would have been cut is its width.
      expect(box.first).toBe(SPREAD.w);
      expect(box.second).toBe(0);
    });
  });

  describe('which way it is cut', () => {
    it('cuts a portrait stage into a top and a bottom', () => {
      expect(paneLayout(PHONE, [BIG, SMALL]).along).toBe('rows');
    });

    it('cuts a landscape stage into a left and a right', () => {
      expect(paneLayout({ w: 844, h: 390 }, [BIG, SMALL]).along).toBe('columns');
    });

    // The same interface turned on its side rather than a second layout, so a square has to land somewhere
    // and always the same somewhere.
    it('cuts a square stage into rows', () => {
      expect(paneLayout({ w: 500, h: 500 }, [BIG, SMALL]).along).toBe('rows');
    });
  });

  describe('how the room is shared', () => {
    it('gives a small pane what it asked for and the rest to the other', () => {
      const box = paneLayout(PHONE, [BIG, SMALL]);

      expect(box.second).toBe(120);
      expect(box.first).toBe(844 - 120);
    });

    it('works the same way round', () => {
      const box = paneLayout(PHONE, [SMALL, BIG]);

      expect(box.first).toBe(120);
      expect(box.second).toBe(844 - 120);
    });

    it('splits evenly when both ask to be big', () => {
      const box = paneLayout(PHONE, [BIG, BIG]);

      expect(box.first).toBe(422);
      expect(box.second).toBe(422);
    });

    // Adam's rule, and the one that is not obvious: two panes both asking to be small would otherwise leave
    // a hole where nothing is. The panes fill the stage between them, so there is nowhere for spare room to
    // go and no reason to leave any.
    it('splits evenly when both ask to be small, whatever they asked for', () => {
      const box = paneLayout(PHONE, [SMALL, STRIP]);

      expect(box.first).toBe(422);
      expect(box.second).toBe(422);
    });

    it('never lets a small pane take more than half, however much it asks for', () => {
      const box = paneLayout(PHONE, [BIG, { small: 9000 }]);

      expect(box.second).toBe(422);
      expect(box.first).toBe(422);
    });

    it('never squeezes a pane below what it takes to show anything', () => {
      const box = paneLayout(PHONE, [BIG, { small: 1 }]);

      expect(box.second).toBe(PANE_LEAST);
    });

    // Minimising is not a case of its own here. A strip is a small pane asking for a smaller number, which
    // is what keeps minimise a property of a view rather than a mode the layout knows about.
    it('treats a minimised pane as a small one asking for less', () => {
      const box = paneLayout(PHONE, [BIG, STRIP]);

      expect(box.second).toBe(44);
      expect(box.first).toBe(800);
    });
  });

  describe('what must always hold', () => {
    // A layout that loses a pixel to rounding grows a seam nobody can find later.
    it('always divides the long side exactly', () => {
      const stages = [PHONE, SPREAD, { w: 844, h: 390 }, { w: 320, h: 240 }, { w: 601, h: 601 }];
      const askings: Asking[] = [BIG, SMALL, STRIP, { small: 9000 }, { small: 0 }];

      for (const stage of stages) {
        for (const head of askings) {
          for (const tail of askings) {
            const box = paneLayout(stage, [head, tail]);
            const long = box.along === 'rows' ? stage.h : stage.w;

            expect(box.first + box.second).toBe(long);
            expect(box.first).toBeGreaterThanOrEqual(0);
            expect(box.second).toBeGreaterThanOrEqual(0);
          }
        }
      }
    });

    // Smaller than the narrowest phone worth designing for, and there is nothing to divide.
    it('gives up dividing a stage too small to divide', () => {
      const box = paneLayout({ w: 40, h: 40 }, [BIG, SMALL]);

      expect(box.first).toBe(40);
      expect(box.second).toBe(0);
    });
  });
});
