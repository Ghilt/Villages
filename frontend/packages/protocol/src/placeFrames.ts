import { z } from 'zod';

import { pointSchema } from './basics';

/**
 * What a page points at on the map, asked of the server: a click that hit no house, person or area sends the place,
 * and the answer says what river is there. The server names it only on ground the house has revealed, from the
 * master's ground map and its real names, and never from the page's own copy of the names. Mirrors the Kotlin
 * `PlaceFrames.kt`. See decision record 0087.
 */

/** Ask what river is at a place: a click on the map that hit nothing else. */
export const inspectAtFrameSchema = z.object({ type: z.literal('inspectAt'), at: pointSchema });

/**
 * A river pointed at: its real identity, a Wikidata id where there is one, and its name in English, with today's
 * beside a name of 1790 the review chose. Neither where no named river is close enough to be the one painted there.
 */
export const riverViewSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  also: z.string().optional(),
  of1790: z.boolean(),
});

/** The answer, for the place asked about: whether the house has revealed it, and the river there or none. */
export const inspectedFrameSchema = z.object({
  type: z.literal('inspected'),
  at: pointSchema,
  revealed: z.boolean(),
  river: riverViewSchema.nullable(),
});

export type RiverView = z.infer<typeof riverViewSchema>;
export type InspectedFrame = z.infer<typeof inspectedFrameSchema>;
