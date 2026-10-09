import type { Recipe } from './layout';

/**
 * The named containers: what a pane, a card or a dialog is drawn as, one entry each.
 *
 * A pane uses a recipe and never sets a border of its own, so a recipe changed is a known set of places
 * changed, and a new pane is a new entry here and perhaps a new picture in `world/ui/` - never new CSS.
 * Named for what they are used for, `pane.<which>`, `card.<which>`, `dialog.<which>`. These are the
 * first, made from the moodboard to show what the layers can do; the game's own come as each surface is
 * redone. Every one is on the page at /admin/inspect-ui-components, under Containers. See
 * docs/UI-COMPONENTS.md.
 */
export const RECIPES = {
  /**
   * Adam's own sentence: a pane with a gilt border and a cherub in the top right corner, which is no part
   * of the nine-slice. It stands on the corner, over the moulding and out past it, and the words keep the
   * whole width.
   */
  'pane.cherub-corner': {
    border: 'gilt-simple',
    fill: 'parchment',
    text: 'ink',
    padding: 8,
    embellishments: [{ art: 'cherub-standing', anchor: 'top-right', overhang: { x: 30, y: 30 } }],
  },

  /**
   * The moodboard's cathedral panel: a cross standing on its crown, a drape hanging behind its right side
   * and a cherub at its foot, stepping out past the frame.
   */
  'pane.cathedral': {
    border: 'gilt-simple',
    fill: 'parchment',
    text: 'ink',
    padding: 8,
    embellishments: [
      { art: 'drape-velvet', anchor: 'top-right', behind: true, overhang: { x: 44, y: -12 }, height: 170 },
      { art: 'cross-gilt', anchor: 'top', overhang: { y: 46 }, height: 62 },
      { art: 'cherub-standing', anchor: 'bottom-right', overhang: { x: 34, y: 20 } },
    ],
  },

  /** The moodboard's own framed pane, with its drape and its cherub painted into the corners. */
  'pane.drape': { border: 'gilt-drape', padding: 4 },

  /**
   * A stone arch on two columns, its own middle showing: the moodboard's stone, which cream is read on and
   * the softer cream is not, so it has no softer ink.
   */
  'pane.arch': { border: 'stone-arch', soft: false, padding: 4 },

  /**
   * Adam's first frame: drapes in all four corners and cherubs in three, the moulding repeated between
   * them, on the dark felt that came with it. Its corners are deep, so its words start well in.
   */
  'pane.cherubs': { border: 'gilt-cherubs', fill: 'dark-felt', padding: 4 },

  /**
   * Adam's second: gilt mouldings, a column down each side, acanthus in the corners, on a dark stone
   * painted to stand in for the one it came on.
   */
  'pane.acanthus': { border: 'gilt-acanthus', fill: 'stone', padding: 4 },

  /**
   * The game's corner, bottom left, where the house, the key figures and navigation take turns: the
   * acanthus frame on its stone, small enough that a tile 232 high keeps most of itself for the words.
   */
  'pane.corner': { border: 'gilt-acanthus', scale: 0.6, fill: 'stone', padding: 2 },

  /** A window in the rail above the corner: the same frame, so the column reads as one. */
  'pane.rail': { border: 'gilt-acanthus', scale: 0.6, fill: 'stone', padding: 2 },

  /** The column down the right, where dialogues are: the cherubs' frame on its felt. */
  'pane.right': { border: 'gilt-cherubs', scale: 0.5, fill: 'dark-felt', padding: 2 },

  /** The letter along the bottom, where a choice is put: the clouds round their own sky. */
  'pane.middle': { border: 'cloud-border', scale: 1, fill: 'cloud-sky', padding: 2 },

  /**
   * A pane of the corner or the rail put away to its 44-pixel strip, which no deep frame fits: the narrow
   * gilt on the same stone, so the strip still reads as the corner's.
   */
  'strip.corner': { border: 'gilt-thin', scale: 0.5, fill: 'stone' },

  /** The right column put away: the narrow gilt on its felt. */
  'strip.right': { border: 'gilt-thin', scale: 0.5, fill: 'dark-felt' },

  /** The letter put away: the narrow gilt on its sky. */
  'strip.middle': { border: 'gilt-thin', scale: 0.5, fill: 'cloud-sky' },

  /**
   * The bottom bar, a phone's way between its panes: the strip's narrow gilt on its stone, because the bar
   * is what the bottom pane is put away to.
   */
  'bar.bottom': { border: 'gilt-thin', scale: 0.5, fill: 'stone' },

  /** A top bar standing on its own, framed: the same, because a pane on top put away is a strip. */
  'bar.top': { border: 'gilt-thin', scale: 0.5, fill: 'stone' },

  /** A plain gilt pane on parchment, with nothing standing out past it: what a tab bar tucks under. */
  'pane.plain': { border: 'gilt-simple', fill: 'parchment', text: 'ink', padding: 8 },

  /** A key figure in a grid: a narrow gilt frame on parchment. */
  'card.figure': { border: 'gilt-thin', fill: 'parchment', text: 'ink', padding: 4 },

  /** Something that happened, as the moodboard's Reformation card has it: a narrow gilt frame on night. */
  'card.event': { border: 'gilt-thin', fill: 'night', padding: 6 },

  /** A crowd of marks opened over the map: the narrow gilt frame on night, as mockup A of 2026-10-15 drew it. */
  'card.pins': { border: 'gilt-thin', fill: 'night', padding: 4 },

  /**
   * A place's name and its figure, on the moodboard's Paris plate: its own parchment, and as wide as its
   * words. That parchment is darker than a sheet, too dark for the softer ink, so it has none.
   */
  'plate.place': { border: 'plate', text: 'ink', soft: false, padding: [0, 4, 0, 0] },

  /** A pane's name on the same plate, a little over half its size. */
  'plate.heading': { border: 'plate', scale: 0.6, text: 'ink', soft: false, padding: [0, 4, 0, 2] },

  /** What a choice of a few stands its options in: the card's frame at half its size, on night. */
  'choice.frame': { border: 'gilt-thin', scale: 0.5, fill: 'night', padding: 1 },

  /** A question asked over the whole page: the plain gilt border on parchment, like a letter held up. */
  'dialog.plain': { border: 'gilt-simple', fill: 'parchment', text: 'ink', padding: 10 },

  /** Something that happened, said in a corner: the card's frame on night, to stand out over the map. */
  'toast.plain': { border: 'gilt-thin', fill: 'night', padding: [2, 4, 2, 6] },

  /** What covers the game while it is made ready: the letter's clouds round their own sky, the whole window. */
  'screen.loading': { border: 'cloud-border', fill: 'cloud-sky', padding: 4 },

  /** A few words about what is under the pointer: the card's frame at half its size, on parchment. */
  'tooltip.plain': { border: 'gilt-thin', scale: 0.5, fill: 'parchment', text: 'ink', padding: [1, 5, 1, 5] },
} as const satisfies Record<string, Recipe>;

export type RecipeName = keyof typeof RECIPES;

export const RECIPE_NAMES = Object.keys(RECIPES) as RecipeName[];
