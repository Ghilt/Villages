import { z } from 'zod';
import { holderViewSchema, pointSchema } from './basics';

/** How structures cross the wire: on the map, in a cell's snapshot and its deltas. See `frames.ts`, and docs/plans/structures.md. */

/**
 * A structure as a house is sent it: the face of the day where it sees, or the one it last saw, with `seenUntil`.
 * `holder` is absent for nobody. `stamp` is the read model's count when this face began: of two copies of one
 * structure the later stamp is the later face, and a snapshot replaces a copy stamped no later than its
 * `structuresAsOf`.
 */
/** What fills a place: a person, with the key of their portrait, or an item, with a line about it and how many. */
export const contentViewSchema = z.object({
  kind: z.enum(['person', 'item']),
  id: z.string(),
  name: z.string(),
  portrait: z.string().optional(),
  about: z.string().optional(),
  amount: z.number().int().optional(),
});

/** One slot as this house is shown it: `contents` absent, not empty, for a slot it may not see into. */
export const slotViewSchema = z.object({
  name: z.string(),
  places: z.number().int(),
  contents: z.array(contentViewSchema).optional(),
});

export const structureViewSchema = z.object({
  id: z.string(),
  structureType: z.string(),
  name: z.string(),
  place: pointSchema,
  cell: z.string(),
  level: z.number().int(),
  holder: holderViewSchema.optional(),
  significance: z.number(),
  since: z.number().int(),
  stamp: z.number().int(),
  seenUntil: z.number().int().optional(),
  /** The house whose seat it is, in the face sent; absent for one that is nobody's seat. */
  seatOf: holderViewSchema.optional(),
  /** True for a ruin, in the face sent; absent for a structure standing. */
  ruin: z.boolean().optional(),
  /** Its slots, only while the house sees it now; absent out of sight, on a day gone by, and for a type with none. */
  slots: z.array(slotViewSchema).optional(),
});

/** A structure came to be in a cell this connection holds and sees. */
export const structureArrivedSchema = z.object({
  type: z.literal('structureArrived'),
  structure: structureViewSchema,
});

/** A structure in a cell this connection holds and sees took a new face: it changed hands. Landed by its stamp. */
export const structureChangedSchema = z.object({
  type: z.literal('structureChanged'),
  structure: structureViewSchema,
});

/**
 * The player's holdings: every structure their house holds now, its seat first and the rest in the order it came to
 * hold them, in today's face. Sent after `yourKeyFigures` on hello and whenever one changes. See structures.md.
 */
export const yourHoldingsFrameSchema = z.object({
  type: z.literal('yourHoldings'),
  holdings: z.array(structureViewSchema),
});

/**
 * Adam's levers for structures, standing in for the world: one raised where the panel looks, Antarctica's sixteen
 * again, one handed to the sender's house, a level up or down, a place of a slot filled or emptied, and one ruined or
 * rebuilt. Commands of the client's, spread into its union of commands. See docs/plans/structures.md.
 */
export const structureCommandSchemas = [
  z.object({
    type: z.literal('raiseStructure'),
    structureType: z.string(),
    level: z.number().int(),
    place: pointSchema,
    yours: z.boolean(),
  }),
  z.object({ type: z.literal('raiseAntarctica') }),
  z.object({ type: z.literal('takeControl'), structureId: z.string() }),
  z.object({ type: z.literal('changeLevel'), structureId: z.string(), by: z.number().int() }),
  z.object({
    type: z.literal('fillSlot'),
    structureId: z.string(),
    slot: z.string(),
    characterId: z.string().optional(),
    item: z
      .object({ name: z.string(), about: z.string().optional(), amount: z.number().int().optional() })
      .optional(),
  }),
  z.object({ type: z.literal('emptySlot'), structureId: z.string(), slot: z.string() }),
  z.object({ type: z.literal('ruinStructure'), structureId: z.string(), cause: z.string() }),
  z.object({ type: z.literal('rebuildStructure'), structureId: z.string() }),
] as const;

export type SlotView = z.infer<typeof slotViewSchema>;
export type ContentView = z.infer<typeof contentViewSchema>;
export type StructureView = z.infer<typeof structureViewSchema>;
