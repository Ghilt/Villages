package villages.application

import villages.domain.DomainError
import villages.domain.HouseError
import java.util.concurrent.atomic.AtomicLong
import kotlin.reflect.KClass

/**
 * A follower that acts on what it hears: for some of what the feed brings, it issues a command. Three are one
 * today - the pledge release, the listener for character deaths and the listener for broken requirements - and
 * the rules they keep are kept here, once:
 *
 * - **Never inside the feed's own callback.** [issueLater] plans the command on `Later`.
 * - **No cancellation table.** A command the world has moved past is refused, and a refusal that means "already
 *   done" is swallowed, which is what makes a replay write nothing twice. Which refusals mean that is the
 *   caller's to say, `settled`, because what "already" means is the command's rule. A house gone in a wipe always
 *   does.
 * - **Everything else is said.** Any other refusal, a write conflict the executor could not get past included,
 *   is a fault under the reaction's name and what it was doing, rather than lost on the timer's thread.
 * - **A wipe forgets what was planned.** A command planned before a wipe is not issued after it, so it asks
 *   nothing of a world it was not planned in. See decision records 0036 and 0055.
 */
abstract class Reaction(
    private val name: String,
    feed: EventFeed,
    private val later: Later,
    private val faults: Faults,
) : Follower(feed) {
    /** Which world what is planned belongs to: one more for every wipe. */
    private val world = AtomicLong()

    /**
     * Plans [command] [afterMs] from now, saying [what] it does should it fail. A refusal of one of the [settled]
     * kinds, or for want of the house, is swallowed; anything else is reported.
     */
    protected fun issueLater(
        what: String,
        settled: Set<KClass<out DomainError>> = emptySet(),
        afterMs: Long = 0,
        command: () -> Unit,
    ) {
        val plannedIn = world.get()
        later.schedule(afterMs.coerceAtLeast(0)) {
            if (world.get() != plannedIn) {
                return@schedule
            }
            try {
                command()
            } catch (refused: DomainError) {
                if (refused !is HouseError.NoSuchHouse && settled.none { it.isInstance(refused) }) {
                    faults.report(Fault(name, what, refused))
                }
            } catch (@Suppress("TooGenericExceptionCaught") thrown: RuntimeException) {
                faults.report(Fault(name, what, thrown))
            }
        }
    }

    /** Forgets what it planned and what it folded, because the world they belonged to has been emptied. */
    final override fun reset() {
        world.incrementAndGet()
        forget()
    }

    /** Forgets what it folded. What it planned is forgotten for it. */
    protected abstract fun forget()
}
