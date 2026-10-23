import { describe, expect, it } from 'vitest';

import type { SessionState } from '@villages/client-core';

import { bayLayout, FOLDS_UNDER, isTabbed, STRIP, TAB_BAR, TILES } from './bayBox';
import {
  type Asked,
  askedInTheSpread,
  CORNER,
  cramps,
  MAP_PANE,
  NAVIGATION_PANE,
  type Pane,
  panesIn,
  type PaneSize,
  SHARED_TILES,
  SIZES,
  sizeAsked,
  sizeOf,
  spreadWants,
} from './panes';
import type { Subject } from '../inspect/subjects';
import { panesOn, standingIn } from '../panes';
import { CHALLENGE_PANE } from '../challenges/pane';
import { DIALOGUE_PANE } from '../dialogues/pane';
import { QUEST_PANE } from '../quests/pane';
import { CHOICE_AT_REST, CHOICE_PANE } from '../choice/pane';
import { KEY_FIGURES_PANE } from '../figures/pane';
import { HOLDINGS_PANE } from '../holdings/pane';
import { HOUSE_PANE } from '../house/pane';

/** None of the panes that come and go; a question standing; a house that has been offered a dialogue. */
const NONE = { yourChoice: null, yourDialogues: null } as unknown as SessionState;
const ASKING = { ...NONE, yourChoice: {} } as unknown as SessionState;
const HOUSED = { ...NONE, yourHouse: {} } as unknown as SessionState;
const TALKING = { ...NONE, yourDialogues: [{}] } as unknown as SessionState;
/** A house with a quest open, and the dialogue it led to. */
const A_QUEST = { id: 'q', revision: 1, title: 'A quest', nodes: [], edges: [], ending: { kind: 'open' } };
const QUESTING = { ...NONE, yourDialogues: [{}], yourQuests: [A_QUEST] } as unknown as SessionState;
/** A quest standing at a challenge node, waiting to be chosen for. */
const CHALLENGED = {
  ...QUESTING,
  yourQuests: [
    {
      ...A_QUEST,
      nodes: [
        {
          id: 'square',
          row: 0,
          state: 'current',
          kind: 'challenge',
          title: 'A challenge',
          challenge: { kind: 'debate', against: { name: 'A rival', colour: '#a8452a' } },
        },
      ],
    },
  ],
} as unknown as SessionState;
const BOTH = { ...NONE, yourChoice: {}, yourDialogues: [{}] } as unknown as SessionState;

/** Every pane on the stage for what the gateway has said and the subjects open, as the stage is handed them. */
const panesFor = (open: readonly Subject[], session: SessionState) =>
  panesOn(standingIn(session), open, () => null);
const idsOf = (panes: readonly Pane[]) => panes.map((pane) => pane.id);

const NOTHING_ASKED: Asked = { heights: {}, tiles: {} };
/** The corner asked to be one of its three sizes, which is the one thing about it a player can ask. */
const cornerAt = (size: PaneSize): Asked => ({ heights: {}, tiles: { bottomLeft: size } });
/** The heights a pane declares are the spread's, and every pane with a tile of its own has them. */
const tallOf = (pane: Pane) => pane.tall!;

describe('panesIn', () => {
  it('gathers the panes that declared themselves into one tile, in the order they were declared', () => {
    expect(panesIn(panesFor([], NONE), 'bottomLeft').map((pane) => pane.id)).toEqual([
      HOUSE_PANE.id,
      KEY_FIGURES_PANE.id,
      HOLDINGS_PANE.id,
      NAVIGATION_PANE.id,
    ]);
  });

  it('puts a window in the column and the map in no tile at all', () => {
    const panes = panesFor([{ kind: 'house', id: 'abc' }], NONE);

    expect(panesIn(panes, 'left')).toHaveLength(1);
    expect(panesIn(panes, 'floor').map((pane) => pane.id)).toEqual(['map']);
  });
});

/**
 * The three sizes, which every pane has and the player picks between.
 *
 * One control and one piece of state. It replaced a set of what was minimised beside a record of what had
 * been resized - the same question asked twice, which let a pane be collapsed *and* small at once. See
 * decision record 0045.
 */
describe('the three sizes', () => {
  it('draws a pane at what was asked for, unless the bay is too small to hold it', () => {
    expect(sizeOf('full', false)).toBe('full');
    expect(sizeOf('full', true)).toBe('small');
    expect(sizeOf('small', false)).toBe('small');
    // Put away stays put away: a bay too small for the full form is not a reason to open one.
    expect(sizeOf('strip', true)).toBe('strip');
  });

  /*
   * Half a phone is not room for the letter laid out, and the whole of one is.
   *
   * The three standard sizes and the carousel meet exactly here. Half of a 390 by 844 phone is a bay 390
   * by 422, which clears neither of the two numbers the full form needs, so it draws the carousel; opened
   * out it is 390 by 800, which clears the height, so it lays the options out. The control goes on marking
   * the middle either way, because it marks the wish and not the outcome. See decision records 0044, 0046.
   */
  it('hands the choice roll its carousel at half a phone and its full form opened out', () => {
    expect(cramps(CHOICE_PANE, { w: 390, h: 422 })).toBe(true);
    expect(cramps(CHOICE_PANE, { w: 390, h: 800 })).toBe(false);
  });

  // Nothing else declares what its full form needs, so nothing else is ever capped.
  it('never caps a pane that did not say what its full form needs', () => {
    expect(cramps(HOUSE_PANE, { w: 40, h: 40 })).toBe(false);
    expect(cramps(MAP_PANE, { w: 40, h: 40 })).toBe(false);
  });
});

describe('spreadWants', () => {
  const panes = panesFor([], NONE);

  it('makes a shared tile its own size, plus the strip of tabs', () => {
    expect(spreadWants(panes, NOTHING_ASKED).bottomLeft).toBe(CORNER.tall.small + TAB_BAR);
  });

  /*
   * The control means something on a desktop too, which is the point of it being one control.
   *
   * The corner has three heights: put away, the normal size, and opened out. It opens at the normal one,
   * which is the house card's whole height, and the other two are the player's own doing.
   */
  it('gives the corner its three heights from what the corner was asked to be', () => {
    expect(spreadWants(panes, cornerAt('strip')).bottomLeft).toBe(STRIP + TAB_BAR);
    expect(spreadWants(panes, cornerAt('small')).bottomLeft).toBe(CORNER.tall.small + TAB_BAR);
    expect(spreadWants(panes, cornerAt('full')).bottomLeft).toBe(CORNER.tall.full + TAB_BAR);
  });

  /*
   * Changing tab never results in a size change, which is the whole of decision record 0057.
   *
   * Every pane in the corner answers with the corner's size, so whichever of them is up - and the layout is
   * not even told which - the corner is the same size, and a pane's own entry never reaches it.
   */
  it('answers every pane in the corner with the corner size, whatever it is', () => {
    for (const size of SIZES) {
      for (const pane of panesIn(panes, 'bottomLeft')) {
        expect(sizeAsked(pane, cornerAt(size))).toBe(size);
      }
    }
    expect(sizeAsked(HOUSE_PANE, { heights: { [HOUSE_PANE.id]: 'strip' }, tiles: {} })).toBe(CORNER.startsAt);
  });

  // A tile whose panes take turns, and that had no sizes of its own, would be sized by whichever tab came
  // first; this is what stops the next tabbed tile from quietly doing that.
  it('has sizes of its own for every tile whose panes take turns', () => {
    const everything = panesFor([{ kind: 'house', id: 'abc' }], {
      ...ASKING,
      yourDialogues: [{}],
    } as unknown as SessionState);

    for (const where of TILES) {
      if (isTabbed(where, panesIn(everything, where).length)) {
        expect(SHARED_TILES[where], where).toBeDefined();
      }
    }
  });

  it('takes no room for the strip when one pane has the tile to itself', () => {
    expect(spreadWants([HOUSE_PANE], NOTHING_ASKED).bottomLeft).toBe(CORNER.tall.small);
  });

  // An empty tile is not a small tile: with no choice pending the map runs clean to the bottom edge.
  it('asks for nothing at all for a tile nobody is in', () => {
    expect(spreadWants(panes, NOTHING_ASKED).bottomMiddle).toBeNull();
    expect(spreadWants([], NOTHING_ASKED).bottomLeft).toBeNull();
  });

  it('says whether anything is in the column above the corner', () => {
    expect(spreadWants(panes, NOTHING_ASKED).left).toBe(false);
    expect(spreadWants(panesFor([{ kind: 'area', id: 'x' }], NONE), NOTHING_ASKED).left).toBe(true);
  });
});

/**
 * The choice roll, which stands once there is a house: at rest it is Take action, put away to its strip, so the map
 * runs nearly to the bottom edge of the stage - and before there is a house or a question it is not there at all.
 * See decision record 0083.
 */
describe('the choice roll', () => {
  it('is not a pane at all until there is a house or a question', () => {
    expect(idsOf(panesFor([], NONE))).not.toContain(CHOICE_PANE.id);
    expect(idsOf(panesFor([], ASKING))).toContain(CHOICE_PANE.id);
    expect(idsOf(panesFor([], HOUSED))).toContain(CHOICE_PANE.id);
  });

  it('takes the bottom middle, its chip at rest and its full height opened', () => {
    expect(spreadWants(panesFor([], NONE), NOTHING_ASKED).bottomMiddle).toBeNull();
    expect(spreadWants(panesFor([], HOUSED), NOTHING_ASKED).bottomMiddle).toBe('strip');
    const opened: Asked = { heights: { [CHOICE_PANE.id]: 'full' }, tiles: {} };
    expect(spreadWants(panesFor([], ASKING), opened).bottomMiddle).toBe(tallOf(CHOICE_PANE).full);
  });

  // At rest all it says is Take action, so opened out it is a box that size rather than one over most of the
  // screen; the same pane by the same id, so the size asked for carries across when a hand arrives. See 0085.
  it('opens out at rest only as tall as Take action, under what a question opens out to', () => {
    const opened: Asked = { heights: { [CHOICE_PANE.id]: 'full' }, tiles: {} };
    const atRest = spreadWants(panesFor([], HOUSED), opened).bottomMiddle;
    const asking = spreadWants(
      panesFor([], { ...HOUSED, yourChoice: {} } as SessionState),
      opened,
    ).bottomMiddle;

    expect(atRest).toBe(tallOf(CHOICE_AT_REST).full);
    expect(asking).toBe(tallOf(CHOICE_PANE).full);
    expect(atRest).toBeLessThan(asking as number);
    expect(CHOICE_AT_REST.id).toBe(CHOICE_PANE.id);
  });

  // It has the tile to itself, so there is no strip of tabs to pay for.
  it('does not share its tile, so it costs no tab bar', () => {
    expect(panesIn(panesFor([], ASKING), 'bottomMiddle')).toHaveLength(1);
  });

  // The one whose small form is a different drawing rather than less of the same thing.
  it('says what its full form needs, so a bay too small for it gets the carousel', () => {
    expect(CHOICE_PANE.needs).not.toBeNull();
  });

  // Put away or opened out over everything, and nothing between: Adam's word of 2026-10-06. See 0085.
  it('offers two sizes in the spread, put away and opened out', () => {
    expect(CHOICE_PANE.spreadSizes).toEqual(['strip', 'full']);
    expect(SIZES).toHaveLength(3);
  });

  // Opened out it lies over everything, so it is never squeezed into the carousel on a desktop.
  it('is never too small for its full form opened out, on the narrowest spread there is', () => {
    const opened: Asked = { heights: { [CHOICE_PANE.id]: 'full' }, tiles: { bottomLeft: 'full' } };
    const wants = spreadWants(panesFor([], BOTH), opened);
    const letter = bayLayout({ w: FOLDS_UNDER + 1, h: 900 }, ['big', 'big'], wants, 'spread').bays
      .bottomMiddle;

    expect(cramps(CHOICE_PANE, letter)).toBe(false);
  });
});

/**
 * Character dialogue, which stands from the house's first dialogue on, in the column down the right edge.
 *
 * It opens at its normal width, where a tile of its own would open full, because opened out it is half the
 * stage and a conversation arriving should not take half the map with it. See decision record 0069.
 */
describe('character dialogue', () => {
  it('is not a pane at all until the house has been offered a dialogue', () => {
    expect(idsOf(panesFor([], NONE))).not.toContain(DIALOGUE_PANE.id);
    expect(idsOf(panesFor([], TALKING))).toContain(DIALOGUE_PANE.id);
  });

  // Finished ones are kept to be read back, so a house that has had one keeps the pane.
  it('is there for any dialogue the house has, and for none before the first frame', () => {
    expect(idsOf(panesFor([], NONE))).not.toContain(DIALOGUE_PANE.id);
    const none = { ...NONE, yourDialogues: [] } as unknown as SessionState;
    expect(idsOf(panesFor([], none))).not.toContain(DIALOGUE_PANE.id);
  });

  it('takes the column down the right edge, and asks for nothing when there is none', () => {
    expect(spreadWants(panesFor([], NONE), NOTHING_ASKED).right).toBeNull();
    expect(spreadWants(panesFor([], TALKING), NOTHING_ASKED).right).toBe('normal');
  });

  it('opens at its normal width, and asks for half the stage opened out and a strip put away', () => {
    const at = (size: PaneSize): Asked => ({ heights: {}, tiles: { right: size } });
    const panes = panesFor([], TALKING);

    expect(sizeAsked(DIALOGUE_PANE, NOTHING_ASKED)).toBe('small');
    expect(spreadWants(panes, at('full')).right).toBe('half');
    expect(spreadWants(panes, at('strip')).right).toBe('strip');
  });
});

/**
 * The corner: the house status, the key figures and navigation, one size whichever of them is up.
 *
 * Its normal size is the house card's whole height and it opens there; opened out, it is what the key
 * figures' details need, and every tab is drawn at that size too. Changing tab never results in a size
 * change. See decision records 0055, 0056 and 0057.
 */
describe('the corner', () => {
  const panes = panesFor([], NONE);

  it('opens at its normal size until the player asks for another, and the choice roll at its strip', () => {
    expect(sizeAsked(KEY_FIGURES_PANE, NOTHING_ASKED)).toBe('small');
    expect(sizeAsked(HOUSE_PANE, NOTHING_ASKED)).toBe('small');
    expect(sizeAsked(CHOICE_PANE, NOTHING_ASKED)).toBe('strip');
    expect(sizeAsked(CHOICE_PANE, { heights: { [CHOICE_PANE.id]: 'full' }, tiles: {} })).toBe('full');
  });

  // Opened out, and only opened out: the corner is the column's width the rest of the time.
  it('reaches along the bottom when it is opened out, and at no other time', () => {
    expect(spreadWants(panes, cornerAt('full')).bottomLeftWide).toBe(CORNER.openWide);
    expect(spreadWants(panes, cornerAt('small')).bottomLeftWide).toBeNull();
    expect(spreadWants(panes, cornerAt('strip')).bottomLeftWide).toBeNull();
  });

  /*
   * Opened out it is as tall as the corner can be and still leave a window room in the rail above it, on
   * the shortest stage the spread is ever drawn on. A hundred and fifty pixels is a window's head and a
   * line or two of it, which is the least a rail is worth keeping.
   */
  it('leaves the rail room for a window when it is opened out on the shortest spread', () => {
    const opened = spreadWants(panesFor([{ kind: 'house', id: 'abc' }], NONE), cornerAt('full'));
    const layout = bayLayout({ w: 1000, h: FOLDS_UNDER + 1 }, ['big', 'big'], opened, 'spread');

    expect(layout.form).toBe('spread');
    expect(layout.bays.left?.h).toBeGreaterThanOrEqual(150);
  });
});

/**
 * Quests, which stand from the house's first quest on, taking turns with the dialogues in the column down the right.
 * See decision record 0096.
 */
describe('quests', () => {
  it('are not a pane at all until the house has been offered a quest', () => {
    expect(idsOf(panesFor([], TALKING))).not.toContain(QUEST_PANE.id);
    expect(idsOf(panesFor([], QUESTING))).toContain(QUEST_PANE.id);
  });

  it('take turns with the dialogues in the column, which is one size whichever is up and opens at its normal width', () => {
    const panes = panesFor([], QUESTING);

    expect(isTabbed('right', panesIn(panes, 'right').length)).toBe(true);
    expect(spreadWants(panes, NOTHING_ASKED).right).toBe('normal');
    expect(spreadWants(panes, { heights: {}, tiles: { right: 'strip' } }).right).toBe('tabbedStrip');
    const asked: Asked = { heights: {}, tiles: { right: 'full' } };
    expect(sizeAsked(QUEST_PANE, asked)).toBe(sizeAsked(DIALOGUE_PANE, asked));
    expect(spreadWants(panesFor([], TALKING), { heights: {}, tiles: { right: 'strip' } }).right).toBe(
      'strip',
    );
  });
});

/**
 * The challenges, which stand while a quest waits at a challenge to be chosen for, a third tab of the column down the
 * right. See decision record 0107, amended.
 */
describe('challenges', () => {
  it('stand only while a quest stands at a challenge, and take turns in the column with the dialogues and the quests', () => {
    expect(idsOf(panesFor([], QUESTING))).not.toContain(CHALLENGE_PANE.id);
    const panes = panesFor([], CHALLENGED);

    expect(idsOf(panes)).toContain(CHALLENGE_PANE.id);
    expect(idsOf(panesIn(panes, 'right'))).toEqual([DIALOGUE_PANE.id, QUEST_PANE.id, CHALLENGE_PANE.id]);
  });
});

/**
 * The corner and the column down the right are never both opened out: opening one steps the other down to its
 * normal size, so the bottom row always has its middle for the letter's chip. Adam's word of 2026-10-06; 0085.
 */
describe('one of the corner and the right column opened out', () => {
  const panes = panesFor([], TALKING);
  const both: Asked = { heights: {}, tiles: { bottomLeft: 'full', right: 'full' } };

  it('steps the dialogues down when the corner opens out, and the corner when the dialogues do', () => {
    const corner = askedInTheSpread(panes, both, KEY_FIGURES_PANE, 'full');
    const right = askedInTheSpread(panes, both, DIALOGUE_PANE, 'full');

    expect(sizeAsked(DIALOGUE_PANE, corner.asked)).toBe('small');
    expect(corner.stepped?.id).toBe(DIALOGUE_PANE.id);
    expect(sizeAsked(HOUSE_PANE, right.asked)).toBe('small');
    expect(right.stepped?.id).toBe(HOUSE_PANE.id);
  });

  it('leaves the other alone when it is not opened out, or when a pane is asked anything but opened out', () => {
    const away: Asked = { heights: {}, tiles: { bottomLeft: 'full', right: 'strip' } };

    expect(askedInTheSpread(panes, away, HOUSE_PANE, 'full').asked).toEqual(away);
    expect(askedInTheSpread(panes, both, HOUSE_PANE, 'small').stepped).toBeNull();
    expect(sizeAsked(DIALOGUE_PANE, askedInTheSpread(panes, both, HOUSE_PANE, 'small').asked)).toBe('full');
  });

  it('has nothing to say about a pane in neither, the letter opened out over both', () => {
    const asked = askedInTheSpread(panesFor([], BOTH), both, CHOICE_PANE, 'full');

    expect(asked.stepped).toBeNull();
    expect(sizeAsked(HOUSE_PANE, asked.asked)).toBe('full');
  });
});
