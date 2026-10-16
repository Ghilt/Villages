import { z } from 'zod';

/**
 * How an inspect page reads what the game server runs on, and saves a catalogue through it. Instruments, like
 * `watchEvents`: a player's interface never sends them, and a server with its instruments closed refuses them. See
 * `frames.ts`, and decision record 0097.
 */

/** Ask what the game server runs on, now and whenever it takes a catalogue on, or stop asking. */
export const watchCataloguesSchema = z.object({ type: z.literal('watchCatalogues'), on: z.boolean() });

/**
 * Save a catalogue file and take it on: its name on the shelf, the file whole, and the fingerprint of the file the
 * page read, so a file changed on disk since is never written over. `''` for a catalogue not yet on the shelf.
 */
export const reviseCatalogueSchema = z.object({
  type: z.literal('reviseCatalogue'),
  catalogue: z.string(),
  text: z.string(),
  basedOn: z.string(),
});

/** What the game server runs on: the SHA-256 of each catalogue in force, by its name on the shelf. */
export const cataloguesInForceSchema = z.object({
  type: z.literal('cataloguesInForce'),
  fingerprints: z.record(z.string(), z.string()),
});

/** A revision saved and taken on: the catalogue, and the fingerprint of the file as it was written. */
export const catalogueRevisedSchema = z.object({
  type: z.literal('catalogueRevised'),
  catalogue: z.string(),
  fingerprint: z.string(),
});

/**
 * A revision refused, and nothing written: `stale` for a file changed on disk since the page read it, `unreadable`
 * for one the server will not take on, `readOnly` for a server that takes no revisions, and `instrumentsClosed`.
 */
export const revisionRefusedSchema = z.object({
  type: z.literal('revisionRefused'),
  catalogue: z.string(),
  code: z.enum(['stale', 'unreadable', 'readOnly', 'instrumentsClosed']),
  reason: z.string(),
});

/** The client's and the server's frames of the catalogues, as `frames.ts` lists them in its unions. */
export const catalogueClientFrames = [watchCataloguesSchema, reviseCatalogueSchema] as const;
export const catalogueServerFrames = [
  cataloguesInForceSchema,
  catalogueRevisedSchema,
  revisionRefusedSchema,
] as const;

export type CataloguesInForceFrame = z.infer<typeof cataloguesInForceSchema>;
export type CatalogueRevisedFrame = z.infer<typeof catalogueRevisedSchema>;
export type RevisionRefusedFrame = z.infer<typeof revisionRefusedSchema>;
