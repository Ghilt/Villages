import { z } from 'zod';
import { pointSchema, resourceNameSchema } from './basics';
import { effectViewSchema } from './choiceFrames';

/** The frames that carry a dialogue to its player. See `frames.ts`, and decision record 0071. */

/** Something a dialogue needs to stay true. `kind` names the case: `alive`, a character by id. See 0071. */
export const requirementViewSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('alive'), character: z.string() }),
]);

/** How a dialogue stands: open, finished, or lost because one of its requirements failed. */
export const endingViewSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('open') }),
  z.object({ kind: z.literal('completed') }),
  z.object({ kind: z.literal('lost'), because: requirementViewSchema }),
]);

/** Who speaks in a dialogue: the party says which side, and nothing about a screen. */
export const speakerViewSchema = z.object({
  id: z.string(),
  party: z.number().int(),
  name: z.string(),
  portrait: z.string().optional(),
  character: z.string().optional(),
});

/** Some of one resource, gained or, below nothing, lost. */
export const impactViewSchema = z.object({ resource: resourceNameSchema, amount: z.number().int() });

/**
 * How an option shows what taking it will do, as whoever wrote it chose: `shown`, with what, or `hidden`,
 * drawn as unknown. An option without one shows nothing until it is done. See decision record 0071.
 */
export const revealImpactViewSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('shown'), impacts: z.array(impactViewSchema).min(1) }),
  z.object({ kind: z.literal('hidden') }),
]);

/**
 * What a line shows as it is reached while playing: a `place`, which the camera is taken to, or a `house` or a
 * `character` by id, which a window is opened on. See decision record 0071.
 */
export const showsViewSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('place'), at: pointSchema }),
  z.object({ kind: z.literal('house'), id: z.string() }),
  z.object({ kind: z.literal('character'), id: z.string() }),
]);

/**
 * A line still to be read, or an option to pick: who says it and the words, and nothing about what it will do
 * but, on an option, its reveal impact. And what it shows, which only a line still ahead carries, so a
 * dialogue read back shows nothing.
 */
export const lineViewSchema = z.object({
  id: z.string(),
  speaker: z.string(),
  words: z.string(),
  revealImpact: revealImpactViewSchema.optional(),
  shows: showsViewSchema.optional(),
});

/** A line said, with what saying it did to the house: what it gave, and what it took. */
export const saidLineViewSchema = z.object({
  id: z.string(),
  speaker: z.string(),
  words: z.string(),
  effects: z.array(effectViewSchema),
});

/**
 * One dialogue as the player may know it. `revision` rises with every change to it. `next` ends in the step
 * to send when there are no `options`, and in the line the dialogue choice follows when there are. Nothing
 * past it is ever sent, and no requirement: a player learns of one only when it fails. See decision record 0071.
 */
export const dialogueViewSchema = z.object({
  id: z.string(),
  revision: z.number().int(),
  title: z.string(),
  scene: z.string().optional(),
  speakers: z.array(speakerViewSchema),
  said: z.array(saidLineViewSchema),
  next: z.array(lineViewSchema),
  options: z.array(lineViewSchema),
  ending: endingViewSchema,
});

export type RequirementView = z.infer<typeof requirementViewSchema>;
export type EndingView = z.infer<typeof endingViewSchema>;
export type SpeakerView = z.infer<typeof speakerViewSchema>;
export type ImpactView = z.infer<typeof impactViewSchema>;
export type RevealImpactView = z.infer<typeof revealImpactViewSchema>;
export type ShowsView = z.infer<typeof showsViewSchema>;
export type LineView = z.infer<typeof lineViewSchema>;
export type SaidLineView = z.infer<typeof saidLineViewSchema>;
export type DialogueView = z.infer<typeof dialogueViewSchema>;
