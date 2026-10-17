import { z } from 'zod';

/**
 * How the debug panel saves the development world under a name, hears which saves there are, and loads one.
 * Instruments, like `wipeWorld`: a player's interface never sends them, and a server with its instruments closed
 * refuses them. A save or a load refused is an `error` of code `saveRefused`, its message saying why; a load done
 * ends every session with `worldWiped`, as a wipe does. See `frames.ts`, and decision record 0101.
 */

/** Save every event of this tree's world under a name, beside every tree, so any of them can be given it again. */
export const saveWorldSchema = z.object({ type: z.literal('saveWorld'), name: z.string() });

/** Ask which saves there are: answered by `savesListed`. */
export const listSavesSchema = z.object({ type: z.literal('listSaves') });

/** Give this tree's world the save of that name, in place of everything it holds, for everybody connected to it. */
export const loadSaveSchema = z.object({ type: z.literal('loadSave'), name: z.string() });

/**
 * One save: its name, when it was made in epoch milliseconds, the player who made it if any, and its events;
 * `unreadable` the first of them this code cannot read, in a line, or null when it can read them all.
 */
export const saveViewSchema = z.object({
  name: z.string(),
  savedAt: z.number().int(),
  by: z.string().nullable(),
  events: z.number().int(),
  unreadable: z.string().nullable(),
});

/** Every save there is, newest first; `saved` is the one this answers the making of, null when it only lists. */
export const savesListedSchema = z.object({
  type: z.literal('savesListed'),
  saves: z.array(saveViewSchema),
  saved: z.string().nullable(),
});

/** The client's and the server's frames of the saves, as `frames.ts` lists them in its unions. */
export const saveClientFrames = [saveWorldSchema, listSavesSchema, loadSaveSchema] as const;
export const saveServerFrames = [savesListedSchema] as const;

export type SaveView = z.infer<typeof saveViewSchema>;
export type SavesListedFrame = z.infer<typeof savesListedSchema>;
