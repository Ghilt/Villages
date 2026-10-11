package villages.application

/**
 * Where the world's events are kept, and what of them this code cannot read, for the debug panel to say when a
 * window says hello. In memory or in MongoDB (decision record 0092); the gateway says it while the instruments are
 * open and never otherwise.
 */
interface WorldKept {
    /** Where its events are kept and what that means for a restart, in a few words. */
    val keptIn: String

    /** What it holds that this code cannot read, from reading all of it as the server started; none after a wipe. */
    fun unreadable(): Unreadable

    companion object {
        /** The world of a server or a test that was told nothing: in memory, where nothing old outlives a restart. */
        val IN_MEMORY: WorldKept = object : WorldKept {
            override val keptIn = "in memory, and gone when the server stops"

            override fun unreadable() = Unreadable.NONE
        }
    }
}

/**
 * What a world holds that this code cannot read, found by reading every event once: an event of a shape the code
 * has since changed, which nothing can fold and whose house refuses every command; or, rarer, an event the store
 * itself cannot read back, which stops the reading there. Pre-alpha the answer is to wipe that world, not to read
 * the old shapes anyway: versioning events, and reading old ones, comes with the world-persistence milestone.
 * See decision record 0036.
 */
data class Unreadable(
    /** How many events could not be read. */
    val events: Int,
    /** How many events were read, those included. */
    val of: Int,
    /** The first that could not, in a line: its type, its stream and why. */
    val first: String? = null,
    /** Where the store itself stopped being readable, in a line, when it did. */
    val brokenAt: String? = null,
) {
    val none: Boolean get() = events == 0 && brokenAt == null

    companion object {
        val NONE = Unreadable(events = 0, of = 0)
    }
}
