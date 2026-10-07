import { z } from 'zod';

import { pointSchema } from './basics';

/**
 * What a page points at on the map, asked of the server: a click that hit no house, person or area sends the place,
 * and the answer says what water is there, a river, a lake or the sea. The server names it only on ground the house
 * has revealed, from the master's ground map and its real names, and never from the page's own copy of the names.
 * Mirrors the Kotlin `PlaceFrames.kt`. See decision record 0087.
 */

/** Ask what water is at a place: a click on the map that hit nothing else. */
export const inspectAtFrameSchema = z.object({ type: z.literal('inspectAt'), at: pointSchema });

/**
 * Water pointed at: whether it is a river, a lake or the sea, its real identity, a Wikidata id where there is one,
 * and its name in English, with today's beside a name of 1790 the review chose, and a line or two about it where one
 * was written. None of them where nothing named is close enough to be the water painted there.
 */
export const waterViewSchema = z.object({
  kind: z.enum(['river', 'lake', 'sea']),
  id: z.string().optional(),
  name: z.string().optional(),
  also: z.string().optional(),
  of1790: z.boolean(),
  about: z.string().optional(),
});

/** The answer, for the place asked about: whether the house has revealed it, and the water there or none. */
export const inspectedFrameSchema = z.object({
  type: z.literal('inspected'),
  at: pointSchema,
  revealed: z.boolean(),
  water: waterViewSchema.nullable(),
});

export type WaterView = z.infer<typeof waterViewSchema>;
export type WaterKind = WaterView['kind'];
export type InspectedFrame = z.infer<typeof inspectedFrameSchema>;
