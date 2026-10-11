import { z } from 'zod';
import { holderViewSchema, pointSchema } from './basics';

/** How structures cross the wire: on the map, in a cell's snapshot and its deltas. See `frames.ts`, and docs/plans/structures.md. */

/**
 * A structure as a house is sent it: the face of the day where it sees, or the one it last saw, with `seenUntil`.
 * `holder` is absent for nobody. `stamp` is the read model's count when this face began: of two copies of one
 * structure the later stamp is the later face, and a snapshot replaces a copy stamped no later than its
 * `structuresAsOf`.
 */
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

export type StructureView = z.infer<typeof structureViewSchema>;
