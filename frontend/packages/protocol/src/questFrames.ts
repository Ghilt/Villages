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
 * A challenge a quest's node puts to the house, as the player may know it before accepting: its kind and who stands
 * against the house. Never the opponent's slices, which arrive only with the run (decision record 0107, amended).
 */
export const questChallengeViewSchema = z.object({
  kind: z.string(),
  against: z.object({ name: z.string(), colour: z.string() }),
});

/**
 * One node drawn on a quest's map: how far down it stands and what it is to the quest now. A question mark carries
 * nothing more; a node shown for what it is carries its kind and title, and its dialogue, objectives, gifts or
 * challenge.
 */
export const questNodeViewSchema = z.object({
  id: z.string(),
  row: z.number().int().nonnegative(),
  state: questNodeStateSchema,
  kind: z.enum(['dialogue', 'checklist', 'reward', 'challenge']).optional(),
  title: z.string().optional(),
  dialogueId: z.string().optional(),
  objectives: z.array(objectiveViewSchema).optional(),
  gives: z.array(effectViewSchema).optional(),
  challenge: questChallengeViewSchema.optional(),
});

/**
 * An edge drawn on the map. An end that is absent is a node not drawn, and the edge a stub towards it. Out of a
 * challenge node shown for what it is, the verdict that leads along it.
 */
export const questEdgeViewSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  state: z.enum(['walked', 'ahead', 'lost']),
  verdict: z.enum(['won', 'lost']).optional(),
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

/**
 * The quest's commands, spread into the command union in `frames.ts`: Adam's lever, a sample quest by its name and
 * none of its words, because a client that could write a quest could write itself a reward; and the player's own,
 * meeting an objective of the node a quest stands at and collecting a reward, by the ids alone - what it costs and
 * for how long is the quest's to say, and whether the house can pay the house's. See decision record 0096.
 */
export const questCommandSchemas = [
  z.object({ type: z.literal('offerQuest'), sample: z.string() }),
  z.object({
    type: z.literal('meetObjective'),
    questId: z.string(),
    nodeId: z.string(),
    objectiveId: z.string(),
  }),
  z.object({ type: z.literal('collectReward'), questId: z.string(), nodeId: z.string() }),
] as const;

export type ObjectiveView = z.infer<typeof objectiveViewSchema>;
export type QuestNodeState = z.infer<typeof questNodeStateSchema>;
export type QuestNodeView = z.infer<typeof questNodeViewSchema>;
export type QuestChallengeView = z.infer<typeof questChallengeViewSchema>;
export type QuestEdgeView = z.infer<typeof questEdgeViewSchema>;
export type QuestView = z.infer<typeof questViewSchema>;
