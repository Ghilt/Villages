import { z } from 'zod';
import { bannerSchema, pointSchema, resourceNameSchema } from './basics';

/** The frames of the choice roll and of every other choice. See `frames.ts`, and decision records 0034 and 0083. */

/**
 * What taking an option would do. `kind` names the case, as it does in the store. See 0034. A `grant` is
 * some of a resource given, and a `spend` some taken: what an option can cost, in a choice or a dialogue. See 0071.
 */
export const effectViewSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('foundAt'), seat: pointSchema, name: z.string(), banner: bannerSchema }),
  z.object({ kind: z.literal('grant'), resource: resourceNameSchema, amount: z.number().int().positive() }),
  z.object({ kind: z.literal('spend'), resource: resourceNameSchema, amount: z.number().int().positive() }),
  /** A conversation begun, by the dialogue's title and nothing of what is said in it. See 0083. */
  z.object({ kind: z.literal('converse'), title: z.string() }),
  /** Some of a resource tied to an undertaking until a world-day, and given back whole then. See 0096. */
  z.object({
    kind: z.literal('pledge'),
    resource: resourceNameSchema,
    amount: z.number().int().positive(),
    until: z.number().int().nonnegative(),
  }),
]);

/** How good a rolled option is, by its lower-case name. See decision record 0083. */
export const raritySchema = z.enum(['common', 'uncommon', 'rare', 'legendary']);

/** Where an omen came from. See decision record 0083. */
export const omenKindSchema = z.enum(['house', 'change', 'window', 'dialogue', 'keyFigure', 'map', 'season']);

/**
 * One thing the fate engine took into account for a roll: a key stable across rolls, where it came from, the
 * words the player reads, and sometimes a value: *Pious 64*.
 */
export const omenViewSchema = z.object({
  key: z.string(),
  kind: omenKindSchema,
  words: z.string(),
  value: z.number().int().optional(),
});

/** One option. A rolled one says its rarity and the keys of the omens that brought it; any other, neither. */
export const optionViewSchema = z.object({
  id: z.string(),
  label: z.string(),
  detail: z.string(),
  effect: effectViewSchema,
  rarity: raritySchema.optional(),
  omens: z.array(z.string()).optional(),
});

/**
 * A choice as the parchment shows it. The interface renders this and nothing else, so a new kind of
 * choice needs no new frame and no new component. See decision record 0034.
 */
export const choiceViewSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  options: z.array(optionViewSchema),
  /** The omens of the roll that dealt it, in the order the report card shows them. Absent for any other choice. */
  omens: z.array(omenViewSchema).optional(),
  /**
   * Where the die of the roll that dealt it landed, and how many kilometres round it the map was read, so the page
   * draws the die where it fell. Absent for any other choice, and for a roll that landed nowhere. See 0118.
   */
  landing: pointSchema.optional(),
  circleKm: z.number().positive().optional(),
});

/**
 * Take action: roll for this player's house. Where its die landed and what the page is looking at, and nothing it
 * could work out for itself, every field a claim the server checks - a window on water by the place it was opened at,
 * which the server reads again - and how wide a circle round the landing is read, the price, the omens and the hand
 * are all the server's. See 0083, 0084, 0087 and 0118.
 */
export const rollPayloadSchema = z.object({
  type: z.literal('roll'),
  landing: pointSchema.optional(),
  inspectingHouses: z.array(z.string()).optional(),
  inspectingCharacters: z.array(z.string()).optional(),
  inspectingWaters: z.array(pointSchema).optional(),
  dialogue: z.string().optional(),
  figure: z.string().optional(),
});

/** Adam's lever: the player's next roll is this rarity, or the throw again when absent. The world's luck. */
export const nextRarityPayloadSchema = z.object({
  type: z.literal('nextRarity'),
  rarity: raritySchema.optional(),
});

/**
 * What a roll drew from, for the debug panel and only while the instruments are open: the pools it opened, which
 * the player never sees, every action that could have been dealt with its weight, the rarity, and whether the
 * lever chose it.
 */
export const rollDrawnFrameSchema = z.object({
  type: z.literal('rollDrawn'),
  opened: z.array(z.string()),
  considered: z.array(z.object({ action: z.string(), weight: z.number().int().positive() })),
  rarity: raritySchema,
  forced: z.boolean(),
});

export type EffectView = z.infer<typeof effectViewSchema>;
export type OptionView = z.infer<typeof optionViewSchema>;
export type ChoiceView = z.infer<typeof choiceViewSchema>;
export type Rarity = z.infer<typeof raritySchema>;
export type OmenView = z.infer<typeof omenViewSchema>;
export type RollDrawnFrame = z.infer<typeof rollDrawnFrameSchema>;
