import { z } from 'zod';
import { resourceNameSchema } from './basics';
import { effectViewSchema } from './choiceFrames';
import { endingViewSchema } from './dialogueFrames';

/** The frames that carry a quest to its player. See `frames.ts`, and decision record 0096. */

/**
 * One objective of a checklist, and whether it is ticked. `kind` names the case: a `deliver` or a `pledge` the player
 * presses for and pays, and a `hold` the world ticks when the house holds a structure of a type, anywhere or on an
 * island.
 */
export const objectiveViewSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('deliver'),
    id: z.string(),
    met: z.boolean(),
    resource: resourceNameSchema,
    amount: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal('pledge'),
    id: z.string(),
    met: z.boolean(),
    resource: resourceNameSchema,
    amount: z.number().int().positive(),
    months: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal('hold'),
    id: z.string(),
    met: z.boolean(),
    structureType: z.string(),
    where: z.enum(['anywhere', 'island']),
  }),
]);

/** What a node is to the quest now. */
export const questNodeStateSchema = z.enum(['done', 'current', 'ahead', 'lost']);

/**
 * One node drawn on a quest's map: how far down it stands and what it is to the quest now. A question mark carries
 * nothing more; a node shown for what it is carries its kind and title, and its dialogue, objectives or gifts.
 */
export const questNodeViewSchema = z.object({
  id: z.string(),
  row: z.number().int().nonnegative(),
  state: questNodeStateSchema,
  kind: z.enum(['dialogue', 'checklist', 'reward']).optional(),
  title: z.string().optional(),
  dialogueId: z.string().optional(),
  objectives: z.array(objectiveViewSchema).optional(),
  gives: z.array(effectViewSchema).optional(),
});

/** An edge drawn on the map. An end that is absent is a node not drawn, and the edge a stub towards it. */
export const questEdgeViewSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  state: z.enum(['walked', 'ahead', 'lost']),
});

/** One quest as the player may know it. `revision` rises with every change; its ending is a dialogue's. */
export const questViewSchema = z.object({
  id: z.string(),
  revision: z.number().int(),
  title: z.string(),
  scene: z.string().optional(),
  nodes: z.array(questNodeViewSchema),
  edges: z.array(questEdgeViewSchema),
  ending: endingViewSchema,
});

export type ObjectiveView = z.infer<typeof objectiveViewSchema>;
export type QuestNodeState = z.infer<typeof questNodeStateSchema>;
export type QuestNodeView = z.infer<typeof questNodeViewSchema>;
export type QuestEdgeView = z.infer<typeof questEdgeViewSchema>;
export type QuestView = z.infer<typeof questViewSchema>;
