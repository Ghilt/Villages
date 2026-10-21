import { z } from 'zod';

/**
 * How the challenges' inspect page has the game server fight a challenge out and show it every moment: an
 * instrument, as the catalogue pages' frames are, answered only to the page that asked and refused while the
 * instruments are closed. Nothing is stored. See `frames.ts`, and decision record 0105.
 */

const standInSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('keyFigure'), name: z.string(), stats: z.record(z.string(), z.number().int()) }),
  z.object({ kind: z.literal('building'), name: z.string(), level: z.number().int() }),
]);

/** A slice as the page builds it: its aspect by name, `violence`, and what stands in its effects' slots. */
export const sliceViewSchema = z.object({
  aspect: z.string(),
  power: z.number(),
  integrity: z.number(),
  summonCount: z.number().int(),
  effects: z.array(z.string()),
  slotted: z.record(z.string(), standInSchema),
});

/** A progression: its seconds, and its happenings in order, each its aspects by name. */
export const progressionViewSchema = z.object({
  seconds: z.number().int(),
  happenings: z.array(z.array(z.string())),
});

/**
 * Fight this challenge out: the page's own id, which the answer carries back; each side's slices; the progression
 * written by hand, or the challenge kind to draw one from; and the seed, a whole number the page can type back, or none
 * for the server to draw one. A frame with neither progression nor kind is refused.
 */
export const simulateChallengeSchema = z.object({
  type: z.literal('simulateChallenge'),
  id: z.string(),
  a: z.array(sliceViewSchema),
  b: z.array(sliceViewSchema),
  progression: progressionViewSchema.optional(),
  kind: z.string().optional(),
  seed: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  runs: z.number().int().min(1).max(10_000).optional(),
});

const sideSchema = z.enum(['a', 'b']);

/** One moment: who acted - a slice, `a1`, a summon, `#7`, or `challenge` - what, by which effect, to whom, how much. */
export const momentViewSchema = z.object({
  second: z.number().int(),
  happening: z.number().int(),
  side: sideSchema.nullable(),
  actor: z.string(),
  what: z.string(),
  effect: z.string().nullable(),
  target: z.string().nullable(),
  amount: z.number().nullable(),
  boosted: z.boolean(),
  tugDelta: z.number(),
  tugAfter: z.number(),
  targetEffect: z.string().nullable(),
});

/** What a challenge came to: the tug toward side A, how it ended and in which second, who won, gains and losses. */
export const outcomeViewSchema = z.object({
  tug: z.number(),
  ended: z.enum(['pulled', 'timeRanOut']),
  second: z.number().int(),
  wonBy: sideSchema.nullable(),
  gains: z.array(
    z.object({ side: sideSchema, resource: z.string(), amount: z.number(), effect: z.string() }),
  ),
  losses: z.array(
    z.object({
      side: sideSchema,
      name: z.string(),
      became: z.enum(['damaged', 'fatigued']),
      effectiveness: z.number(),
      effect: z.string(),
    }),
  ),
});

/** A challenge fought: its seed, the catalogue's fingerprint, its progression, outcome, moments and summons. */
export const challengeSimulatedSchema = z.object({
  type: z.literal('challengeSimulated'),
  id: z.string(),
  seed: z.number().int(),
  catalogue: z.string(),
  progression: progressionViewSchema,
  outcome: outcomeViewSchema,
  moments: z.array(momentViewSchema),
  summons: z.array(z.object({ serial: z.number().int(), kind: z.string(), called: z.string().nullable() })),
  batch: z
    .object({
      runs: z.number().int(),
      wonByA: z.number().int(),
      wonByB: z.number().int(),
      even: z.number().int(),
      pulledByA: z.number().int(),
      pulledByB: z.number().int(),
      meanTug: z.number(),
      tugEnds: z.number(),
      /** For every second of the longest run, how many runs stood in each of twenty-two bands of the tug then. */
      spread: z.array(z.array(z.number().int())),
      /** How many runs ended in each band: pulled to B's end first, twenty between, pulled to A's end last. */
      ends: z.array(z.number().int()),
    })
    .optional(),
});

/** A challenge not fought: `invalidSetup`, saying why, or `instrumentsClosed`. */
export const simulationRefusedSchema = z.object({
  type: z.literal('simulationRefused'),
  id: z.string(),
  code: z.enum(['invalidSetup', 'instrumentsClosed']),
  reason: z.string(),
});

/** The client's and the server's frames of the challenges, as `frames.ts` lists them in its unions. */
export const challengeClientFrames = [simulateChallengeSchema] as const;
export const challengeServerFrames = [challengeSimulatedSchema, simulationRefusedSchema] as const;

export type SimulateChallengeFrame = z.infer<typeof simulateChallengeSchema>;
export type SliceView = z.infer<typeof sliceViewSchema>;
export type ProgressionView = z.infer<typeof progressionViewSchema>;
export type MomentView = z.infer<typeof momentViewSchema>;
export type OutcomeView = z.infer<typeof outcomeViewSchema>;
export type ChallengeSimulatedFrame = z.infer<typeof challengeSimulatedSchema>;
export type SimulationRefusedFrame = z.infer<typeof simulationRefusedSchema>;
