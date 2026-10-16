package villages.protocol

/*
 * How an inspect page reads what the game server runs on, and saves a catalogue through it. Instruments, like
 * `watchEvents`: a player's interface never sends them, and a server with its instruments closed refuses them. See
 * decision record 0097.
 */

/** Asks what the game server runs on, now and whenever it takes a catalogue on, or stops asking. */
data class WatchCatalogues(val on: Boolean) : ClientFrame

/**
 * Asks the game server to save a catalogue file and take it on: [catalogue] its name on the shelf, [text] the file
 * whole, and [basedOn] the fingerprint of the file the page read, so a file changed on disk since is never written over.
 */
data class ReviseCatalogue(val catalogue: String, val text: String, val basedOn: String) : ClientFrame

/** What the game server runs on: the SHA-256 of each catalogue in force, by its name on the shelf. */
data class CataloguesInForce(val fingerprints: Map<String, String>) : ServerFrame

/** A revision saved and taken on: the catalogue, and the fingerprint of the file as it was written. */
data class CatalogueRevised(val catalogue: String, val fingerprint: String) : ServerFrame

/**
 * A revision refused, and nothing written: [code] is `stale` for a file changed on disk since the page read it,
 * `unreadable` for one the server will not take on, `readOnly` for a server that takes no revisions, and
 * `instrumentsClosed`; [reason] says it in words.
 */
data class RevisionRefused(val catalogue: String, val code: String, val reason: String) : ServerFrame
