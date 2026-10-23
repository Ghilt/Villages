import { z } from 'zod';

import { outcomeViewSchema } from './challengeFrames';

/**
 * One challenge the house fought, as its history says it: its id and title, the quest that raised it, its kind, the
 * house's name and who stood against it, the starting slices brought, what it came to, when it was fought, and the
 * title of the node the quest went on to, absent until heard. `revision` rises with every change. See decision record
 * 0107, amended.
 */
export const challengeRowViewSchema = z.object({
  id: z.string(),
  revision: z.number().int(),
  title: z.string(),
  quest: z.string(),
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

export type ChallengeRowView = z.infer<typeof challengeRowViewSchema>;
