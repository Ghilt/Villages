import { z } from 'zod';

import {
  momentViewSchema,
  outcomeViewSchema,
  progressionViewSchema,
  sliceViewSchema,
} from './challengeFrames';

/**
 * One challenge the house fought, as its history says it: its id and title, the quest that raised it by its title and
 * its id, and the node by its id, its kind, the
 * house's name and who stood against it, the starting slices brought, what it came to, when it was fought, and the
 * title of the node the quest went on to, absent until heard. `revision` rises with every change. See decision record
 * 0107, amended.
 */
export const challengeRowViewSchema = z.object({
  id: z.string(),
  revision: z.number().int(),
  title: z.string(),
  quest: z.string(),
  questId: z.string(),
  nodeId: z.string(),
  kind: z.string(),
  house: z.string(),
  against: z.object({ name: z.string(), colour: z.string() }),
  brought: z.array(z.string()),
  outcome: outcomeViewSchema,
  foughtAt: z.string(),
  then: z.string().optional(),
});

/**
 * The player's challenges, every one the house fought, in the order it fought them. Always a list, sent after
 * `yourQuests` on hello and again whenever one changes.
 */
export const yourChallengesSchema = z.object({
  type: z.literal('yourChallenges'),
  challenges: z.array(challengeRowViewSchema),
});

/** Fight a challenge of the player's house again, to watch it: answered with `challengeRun`. */
export const watchChallengeSchema = z.object({
  type: z.literal('watchChallenge'),
  challengeId: z.string(),
});

/**
 * A challenge of the player's house fought again to be watched: each side's slices as it was fought, its progression,
 * the recorded outcome, and the moments and summons of the fight again - none when the catalogue in force can no
 * longer fight it. `differs` when the fight again came out otherwise than recorded, or could not be fought.
 */
export const challengeRunSchema = z.object({
  type: z.literal('challengeRun'),
  id: z.string(),
  sides: z.object({ a: z.array(sliceViewSchema), b: z.array(sliceViewSchema) }),
  progression: progressionViewSchema,
  outcome: outcomeViewSchema,
  moments: z.array(momentViewSchema),
  summons: z.array(z.object({ serial: z.number().int(), kind: z.string(), called: z.string().nullable() })),
  differs: z.boolean(),
});

export type ChallengeRowView = z.infer<typeof challengeRowViewSchema>;
export type WatchChallengeFrame = z.infer<typeof watchChallengeSchema>;
export type ChallengeRunFrame = z.infer<typeof challengeRunSchema>;
