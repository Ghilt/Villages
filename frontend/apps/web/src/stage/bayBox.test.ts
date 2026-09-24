import { describe, expect, it } from 'vitest';

import {
  type Asking,
  BAY_LEAST,
  bayLayout,
  type Box,
  COLUMN_LEAST,
  COLUMN_WANTS,
  FOLDS_UNDER,
  formFor,
  GUTTER,
  inside,
  isTabbed,
  MIDDLE_LEAST,
  overlap,
  type Rect,
  sharedBy,
  type SpreadWants,
  TILES,
  UNFOLDS_OVER,
  WANTS_NOTHING,
} from './bayBox';

/** The stage the phone toggle makes, which is the shape the whole two-bay form exists for. */
const PHONE = { w: 390, h: 844 };
/** A stage with the debug panel at the width it wants on a 1920 monitor. */
const SPREAD = { w: 1568, h: 1080 };

const BIG: Asking = 'big';
const SMALL: Asking = { small: 120 };
const STRIP: Asking = { small: 44 };

/** What the spread looks like with everything in it: a rail, a house in the corner, a choice pending. */
const EVERYTHING: SpreadWants = { left: true, bottomLeft: 200, bottomMiddle: 132 };

/** The same, with the corner opened out on a pane that asks to reach along the bottom. */
const REACHING: SpreadWants = { ...EVERYTHING, bottomLeft: 370, bottomLeftWide: 560 };

const tilesOf = (box: { bays: Readonly<Record<string, Rect | null>> }): Rect[] =>
  TILES.map((name) => box.bays[name]).filter((rect): rect is Rect => rect != null);

describe('formFor', () => {
  it('is the spread while the shorter side has room to spare', () => {
    expect(formFor(SPREAD, 'spread')).toBe('spread');
  });

  it('folds once the shorter side reaches the number, and not one pixel before', () => {
    expect(formFor({ w: FOLDS_UNDER + 1, h: 2000 }, 'spread')).toBe('spread');
    expect(formFor({ w: FOLDS_UNDER, h: 2000 }, 'spread')).toBe('bays');
  });

  // A short wide window folds for the same reason a narrow tall one does: the side that ran out is the
  // short one, whichever side that happens to be.
  it('reads the shorter side whichever side it is', () => {
    expect(formFor({ w: 2000, h: FOLDS_UNDER }, 'spread')).toBe('bays');
  });

  describe('the dead band', () => {
    // The whole point of two numbers. A stage sitting between them keeps what it had, so a grip dragged
    // slowly across the boundary cannot make the layout flicker between two whole forms.
    it('keeps the form it had anywhere between the two numbers', () => {
      for (let shorter = FOLDS_UNDER + 1; shorter < UNFOLDS_OVER; shorter += 1) {
        const stage = { w: shorter, h: 2000 };
        expect(formFor(stage, 'bays')).toBe('bays');
        expect(formFor(stage, 'spread')).toBe('spread');
      }
    });

    it('unfolds only once it is past the far number', () => {
      expect(formFor({ w: UNFOLDS_OVER - 1, h: 2000 }, 'bays')).toBe('bays');
      expect(formFor({ w: UNFOLDS_OVER, h: 2000 }, 'bays')).toBe('spread');
    });

    // Whatever it answers, asking again with that answer has to give the same one back, or the form
    // would change every time the component re-rendered without anything else moving.
    it('settles: asking again with its own answer never changes it', () => {
      for (let shorter = 400; shorter <= 900; shorter += 7) {
        for (const was of ['spread', 'bays'] as const) {
          const stage = { w: shorter, h: 2000 };
          const once = formFor(stage, was);
          expect(formFor(stage, once)).toBe(once);
        }
      }
    });
  });
});

/**
 * How panes sharing a bay divide it, which is a property of the bay and not of how many there are.
 *
 * Reading it off the count alone was a real defect: a second inspect window made the rail grow a strip of
 * tabs across the top of its first window, on a bay whose whole purpose is that the windows stack.
 */
describe('sharedBy', () => {
  it('stacks the rail, because comparing two windows should not mean remembering one', () => {
    expect(sharedBy('left')).toBe('stack');
  });

  it('tabs the corner and the bottom middle, where panes are alternatives', () => {
    expect(sharedBy('bottomLeft')).toBe('tabs');
    expect(sharedBy('bottomMiddle')).toBe('tabs');
  });

  it('never tabs a bay with one pane in it, or none', () => {
    expect(isTabbed('bottomLeft', 1)).toBe(false);
    expect(isTabbed('bottomLeft', 0)).toBe(false);
  });

  it('tabs a shared bay whose panes take turns', () => {
    expect(isTabbed('bottomLeft', 2)).toBe(true);
  });

  // The defect, as a test: three windows in the rail are not three tabs.
  it('never tabs the rail, however many windows are in it', () => {
    expect(isTabbed('left', 2)).toBe(false);
    expect(isTabbed('left', 3)).toBe(false);
  });

  it('never tabs a pane that is in no bay at all', () => {
    expect(isTabbed(null, 3)).toBe(false);
  });
});

describe('the bays', () => {
  const bays = (stage: Box, asking: readonly [Asking, Asking]) =>
    bayLayout(stage, asking, WANTS_NOTHING, 'bays');

  describe('which way it is cut', () => {
    it('cuts a portrait stage into a top and a bottom', () => {
      expect(bays(PHONE, [BIG, SMALL]).along).toBe('rows');
    });

    it('cuts a landscape stage into a left and a right', () => {
      expect(bays({ w: 844, h: 390 }, [BIG, SMALL]).along).toBe('columns');
    });

    it('cuts a square stage into rows, arbitrarily but always the same way', () => {
      expect(bays({ w: 500, h: 500 }, [BIG, SMALL]).along).toBe('rows');
    });
  });

  describe('how the room is shared', () => {
    it('gives a small bay what it asked for and the rest to the other', () => {
      const box = bays(PHONE, [BIG, SMALL]);

      expect(box.bays.second?.h).toBe(120);
      expect(box.bays.first?.h).toBe(PHONE.h - 120);
    });

    it('does the same when the small one is first', () => {
      const box = bays(PHONE, [SMALL, BIG]);

      expect(box.bays.first?.h).toBe(120);
      expect(box.bays.second?.h).toBe(PHONE.h - 120);
    });

    it('gives half each when both ask to be big', () => {
      const box = bays(PHONE, [BIG, BIG]);

      expect(box.bays.first?.h).toBe(422);
      expect(box.bays.second?.h).toBe(422);
    });

    // Adam's rule, and the one that is not obvious: two bays both asking to be small would otherwise leave
    // a hole where nothing is. The bays fill the stage between them, so there is nowhere for spare room to
    // go and no reason to leave any.
    it('gives half each when both ask to be small', () => {
      const box = bays(PHONE, [SMALL, STRIP]);

      expect(box.bays.first?.h).toBe(422);
      expect(box.bays.second?.h).toBe(422);
    });

    it('never lets a small bay take more than half, however much it asks for', () => {
      const box = bays(PHONE, [BIG, { small: 9000 }]);

      expect(box.bays.second?.h).toBe(422);
    });

    it('never squeezes a bay below what it takes to show anything', () => {
      const box = bays(PHONE, [BIG, { small: 1 }]);

      expect(box.bays.second?.h).toBe(BAY_LEAST);
    });

    // Minimising is not a case of its own here. A strip is a small bay asking for a smaller number, which
    // is what keeps minimise a property of a pane rather than a mode the layout knows about.
    it('treats a minimised bay as a small one asking for less', () => {
      const box = bays(PHONE, [BIG, STRIP]);

      expect(box.bays.second?.h).toBe(44);
      expect(box.bays.first?.h).toBe(PHONE.h - 44);
    });
  });

  // A layout that loses a pixel to rounding grows a seam nobody can find later.
  it('always fills the long side exactly, whatever was asked for', () => {
    for (const stage of [PHONE, { w: 844, h: 390 }, { w: 601, h: 599 }, { w: 375, h: 667 }]) {
      for (const head of [BIG, SMALL, STRIP, { small: 333 }] as Asking[]) {
        for (const tail of [BIG, SMALL, STRIP, { small: 333 }] as Asking[]) {
          const box = bays(stage, [head, tail]);
          const long = box.along === 'rows' ? stage.h : stage.w;
          const got =
            box.along === 'rows'
              ? (box.bays.first?.h ?? 0) + (box.bays.second?.h ?? 0)
              : (box.bays.first?.w ?? 0) + (box.bays.second?.w ?? 0);

          expect(got).toBe(long);
        }
      }
    }
  });

  it('gives the one box to the first bay when there is no room to divide at all', () => {
    const box = bayLayout({ w: 40, h: 40 }, [BIG, SMALL], WANTS_NOTHING, 'bays');

    expect(box.bays.first).toEqual({ x: 0, y: 0, w: 40, h: 40 });
    expect(box.bays.second).toBeNull();
  });
});

describe('the spread', () => {
  const spread = (stage: Box, wants: SpreadWants = EVERYTHING) =>
    bayLayout(stage, [BIG, BIG], wants, 'spread');

  it('gives the whole stage to the floor, whatever else is on it', () => {
    expect(spread(SPREAD).bays.floor).toEqual({ x: 0, y: 0, w: SPREAD.w, h: SPREAD.h });
    expect(spread(SPREAD, WANTS_NOTHING).bays.floor).toEqual({ x: 0, y: 0, w: SPREAD.w, h: SPREAD.h });
  });

  it('has no bays of the folded form, and the folded form has no tiles', () => {
    expect(spread(SPREAD).bays.first).toBeNull();
    expect(bayLayout(PHONE, [BIG, BIG], EVERYTHING, 'bays').bays.floor).toBeNull();
  });

  // An empty tile is not a small tile. With no choice pending the map runs clean to the bottom edge, and
  // with nothing in the corner the column runs to it.
  it('lays out nothing at all for a tile nobody is in', () => {
    const box = spread(SPREAD, WANTS_NOTHING);

    expect(tilesOf(box)).toEqual([]);
  });

  it('gives the column to the corner alone when there is no rail', () => {
    const box = spread(SPREAD, { left: false, bottomLeft: 200, bottomMiddle: null });

    expect(box.bays.left).toBeNull();
    expect(box.bays.bottomLeft).toEqual({ x: 0, y: SPREAD.h - 200, w: COLUMN_WANTS, h: 200 });
  });

  it('runs the column to the bottom when there is nothing in the corner', () => {
    const box = spread(SPREAD, { left: true, bottomLeft: null, bottomMiddle: null });

    expect(box.bays.left?.y ?? 0).toBeGreaterThan(0);
    expect((box.bays.left?.y ?? 0) + (box.bays.left?.h ?? 0)).toBe(SPREAD.h);
  });

  it('sets the column into the left and bottom edges rather than floating it off them', () => {
    const box = spread(SPREAD);

    expect(box.bays.left?.x).toBe(0);
    expect(box.bays.bottomLeft?.x).toBe(0);
    expect((box.bays.bottomLeft?.y ?? 0) + (box.bays.bottomLeft?.h ?? 0)).toBe(SPREAD.h);
  });

  it('gives the column and the corner one shared edge, so they read as one column', () => {
    const box = spread(SPREAD);

    expect(box.bays.left?.w).toBe(box.bays.bottomLeft?.w);
  });

  describe('how wide the column is', () => {
    it('is the width the house card was drawn at, where there is room for it', () => {
      expect(spread(SPREAD).bays.left?.w).toBe(COLUMN_WANTS);
    });

    it('is squeezed to a third of a narrow stage rather than taking half of it', () => {
      // 700 wide: a third is 222, which is under the least, so the least is what it gets.
      expect(spread({ w: 700, h: 900 }).bays.left?.w).toBe(COLUMN_LEAST);
      // 1200 wide: a third is 389, which is real room and less than the card wants.
      expect(spread({ w: 1200, h: 900 }).bays.left?.w).toBe(389);
    });

    it('never gives the column more than the card asked for, however wide the stage', () => {
      expect(spread({ w: 3840, h: 2160 }).bays.left?.w).toBe(COLUMN_WANTS);
    });
  });

  /*
   * The corner opened out, on a pane that asks to be wider than the column: the one tile whose width is
   * not the column's. It grows along the bottom edge, the rail above keeps the column's width, and a letter
   * along the bottom moves over. See decision record 0056.
   */
  describe('the corner reaching along the bottom', () => {
    it('takes the width it asked for and leaves the rail the column', () => {
      const box = spread(SPREAD, REACHING);

      expect(box.bays.bottomLeft?.w).toBe(560);
      expect(box.bays.left?.w).toBe(COLUMN_WANTS);
      expect(box.bays.bottomLeft?.x).toBe(0);
    });

    it('moves the bottom middle over, rather than lying on it', () => {
      const box = spread(SPREAD, REACHING);

      expect(box.bays.bottomMiddle?.x ?? 0).toBeGreaterThanOrEqual(560 + GUTTER);
    });

    it('is never narrower than the column, whatever it asked for', () => {
      expect(spread(SPREAD, { ...REACHING, bottomLeftWide: 100 }).bays.bottomLeft?.w).toBe(COLUMN_WANTS);
    });

    // 800 wide: the most the corner can take and leave the letter what it could always be read at.
    it('stops where the bottom middle would go below the least it is ever left', () => {
      const stage = { w: 800, h: 900 };
      const box = spread(stage, { ...REACHING, bottomLeftWide: 5000 });

      expect(box.bays.bottomLeft?.w).toBe(stage.w - GUTTER * 2 - MIDDLE_LEAST);
      expect(box.bays.bottomMiddle?.w).toBe(MIDDLE_LEAST);
    });

    // Capped against the letter whether or not the letter is there, so one arriving never resizes it.
    it('is the same width with a letter along the bottom and without one', () => {
      for (const w of [700, 800, 1000, 1568]) {
        const stage = { w, h: 900 };
        expect(spread(stage, { ...REACHING, bottomMiddle: null }).bays.bottomLeft?.w).toBe(
          spread(stage, REACHING).bays.bottomLeft?.w,
        );
      }
    });
  });

  describe('the tile along the bottom middle', () => {
    it('starts clear of the column, with air between them', () => {
      const box = spread(SPREAD);
      const column = box.bays.left?.w ?? 0;

      expect(box.bays.bottomMiddle?.x ?? 0).toBeGreaterThanOrEqual(column + GUTTER);
    });

    it('takes the whole width when there is no column beside it', () => {
      const box = spread(SPREAD, { left: false, bottomLeft: null, bottomMiddle: 132 });

      expect(box.bays.bottomMiddle?.x).toBe(GUTTER + Math.round((SPREAD.w - GUTTER * 2 - 736) / 2));
    });

    it('stops growing at a width three options still read as sentences across', () => {
      expect(spread({ w: 3840, h: 2160 }).bays.bottomMiddle?.w).toBe(736);
    });

    /*
     * The answer to "what if the bottom row is too narrow for both", which was a real question before the
     * arithmetic existed to answer it.
     *
     * It cannot get very narrow: the column is capped at a third of the stage and the spread only happens
     * above 600 on the shorter side, so the room left along the bottom has a floor. That floor is wide
     * enough for the carousel, which is why the row never has to make the corner yield its tile. If someone
     * widens the column, this is the test that says the bottom row stopped fitting.
     */
    it('never gets narrower than the carousel needs, at any stage the spread can be', () => {
      let narrowest = Infinity;
      for (let w = 601; w <= 2400; w += 7) {
        for (const h of [601, 700, 900, 1080, 1440]) {
          // With the corner as it always was, and opened out reaching along the bottom as far as it can
          // be asked to: the floor is the same either way, which is what the corner's cap is for.
          for (const wants of [EVERYTHING, REACHING, { ...REACHING, bottomLeftWide: 5000 }]) {
            const box = spread({ w, h }, wants);
            narrowest = Math.min(narrowest, box.bays.bottomMiddle?.w ?? Infinity);
          }
        }
      }

      expect(narrowest).toBeGreaterThanOrEqual(MIDDLE_LEAST);
    });

    it('sits a gutter off the bottom, because it has no edge of its own to be cut into', () => {
      const box = spread(SPREAD);

      expect((box.bays.bottomMiddle?.y ?? 0) + (box.bays.bottomMiddle?.h ?? 0)).toBe(SPREAD.h - GUTTER);
    });
  });
});

/**
 * The one promise this module exists to keep.
 *
 * Adam's rule for the spread is that the tiles never overlap each other, and the reason the layout is
 * arithmetic rather than a stylesheet is so that the rule can be a test instead of a hope. It is swept over
 * every stage the spread can be, every combination of tiles being in or out, and both forms - because a
 * layout that holds at one size and not at another is a layout that has not been checked.
 */
describe('the tiles never overlap, and none leaves the stage', () => {
  const stages: Box[] = [];
  for (let w = 620; w <= 2000; w += 61) {
    for (const h of [620, 700, 900, 1080, 1440]) {
      stages.push({ w, h });
    }
  }
  // And the folded form, where the two bays must not overlap either.
  const folded: Box[] = [PHONE, { w: 844, h: 390 }, { w: 320, h: 480 }, { w: 599, h: 599 }];

  const everyWant: SpreadWants[] = [];
  for (const left of [true, false]) {
    for (const bottomLeft of [null, 44, 200, 5000]) {
      for (const bottomMiddle of [null, 132, 400]) {
        // And the corner opened out, reaching along the bottom by as much as it can be asked to.
        for (const bottomLeftWide of [null, 560, 5000]) {
          everyWant.push({ left, bottomLeft, bottomLeftWide, bottomMiddle });
        }
      }
    }
  }

  it('holds across every stage the spread can be, and every tile being in or out', () => {
    for (const stage of stages) {
      for (const wants of everyWant) {
        const box = bayLayout(stage, [BIG, BIG], wants, 'spread');
        const tiles = tilesOf(box);

        for (const tile of tiles) {
          expect(tile.w).toBeGreaterThan(0);
          expect(tile.h).toBeGreaterThan(0);
          expect(inside(tile, stage), `${JSON.stringify({ stage, wants, tile })} left the stage`).toBe(true);
        }

        for (let one = 0; one < tiles.length; one += 1) {
          for (let other = one + 1; other < tiles.length; other += 1) {
            expect(
              overlap(tiles[one]!, tiles[other]!),
              `${JSON.stringify({ stage, wants, a: tiles[one], b: tiles[other] })} overlap`,
            ).toBe(false);
          }
        }
      }
    }
  });

  it('holds in the folded form too, whatever the two bays asked for', () => {
    for (const stage of folded) {
      for (const head of [BIG, SMALL, STRIP] as Asking[]) {
        for (const tail of [BIG, SMALL, STRIP] as Asking[]) {
          const tiles = tilesOf(bayLayout(stage, [head, tail], WANTS_NOTHING, 'bays'));

          for (const tile of tiles) {
            expect(inside(tile, stage)).toBe(true);
          }
          for (let one = 0; one < tiles.length; one += 1) {
            for (let other = one + 1; other < tiles.length; other += 1) {
              expect(overlap(tiles[one]!, tiles[other]!)).toBe(false);
            }
          }
        }
      }
    }
  });
});
