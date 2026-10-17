import { z } from 'zod';

/**
 * How the debug panel saves the development world under a name, and hears which saves there are. Instruments, like
 * `wipeWorld`: a player's interface never sends them, and a server with its instruments closed refuses them. A save
 * refused is an `error` of code `saveRefused`, its message saying why. See `frames.ts`, and decision record 0101.
 */

/** Save every event of this tree's world under a name, beside every tree, so any of them can be given it again. */
export const saveWorldSchema = z.object({ type: z.literal('saveWorld'), name: z.string() });

/** One save: its name, when it was made in epoch milliseconds, the player who made it if any, and its events. */
export const saveViewSchema = z.object({
  name: z.string(),
  savedAt: z.number().int(),
  by: z.string().nullable(),
  events: z.number().int(),
});

/** Every save there is, newest first; `saved` is the one this answers the making of, null when it only lists. */
export const savesListedSchema = z.object({
  type: z.literal('savesListed'),
  saves: z.array(saveViewSchema),
  saved: z.string().nullable(),
});

/** The client's and the server's frames of the saves, as `frames.ts` lists them in its unions. */
export const saveClientFrames = [saveWorldSchema] as const;
export const saveServerFrames = [savesListedSchema] as const;

export type SaveView = z.infer<typeof saveViewSchema>;
export type SavesListedFrame = z.infer<typeof savesListedSchema>;
