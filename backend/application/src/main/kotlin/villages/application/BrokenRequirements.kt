package villages.application

import villages.domain.DialogueId
import villages.domain.Event
import villages.domain.FailRequirement
import villages.domain.HouseError
import villages.domain.HouseId
import villages.domain.PlayerCompletedDialogue
import villages.domain.PlayerLostDialogue
import villages.domain.PlayerOfferedDialogue
import villages.domain.Requirement
import villages.domain.requirementsBrokenBy
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * The listener for broken requirements: when an event breaks a requirement, every house with an open dialogue
 * that needs it is told, and the house's own rules lapse what the failure ends.
 *
 * It knows no kinds of requirement. Which requirements an event breaks is one pure function in the domain,
 * [requirementsBrokenBy], handed in here so a test can hand it another; a new kind of requirement is a case
 * there and never a change here. It follows the feed from the beginning with a fold of its own, as every
 * listener that acts on its own does: which open dialogues need which requirements, from the offers and their
 * ends, and every requirement that has failed for good, with the event that broke it. See decision record 0071.
 *
 * **Either order ends it.** A requirement broken finds the dialogues that need it; a dialogue offered with one
 * already broken - somebody already dead - finds the failure, and lapses at once.
 *
 * Every failure continues the story of the event that broke the requirement, and is caused by the event that
 * set it off, so the event list reads a death and the dialogues it ended as one thing. It issues through
 * `Later`, never inside the feed's own callback, and cancels nothing: a failure that touches no open dialogue
 * writes nothing, and a house gone in a wipe is swallowed, which is what makes a replay write nothing twice.
 */
class BrokenRequirements(
    feed: EventFeed,
    private val later: Later,
    private val houses: HouseCommandExecutor,
    private val clock: Clock,
    private val world: WorldClock,
    private val breaks: (Event) -> Set<Requirement> = ::requirementsBrokenBy,
) : Follower(feed) {
    /** What each open dialogue needs, by the house it is open in. */
    private val needs = ConcurrentHashMap<Pair<HouseId, DialogueId>, Set<Requirement>>()

    /** The other way round: the open dialogues that need each requirement, which is what a failure asks. */
    private val needing = ConcurrentHashMap<Requirement, MutableSet<Pair<HouseId, DialogueId>>>()

    /** Every requirement that has failed for good, with the event that broke it. */
    private val failed = ConcurrentHashMap<Requirement, StoredEvent>()

    override fun apply(stored: StoredEvent) {
        when (val event = stored.event) {
            is PlayerOfferedDialogue -> {
                val open = event.houseId to event.dialogue.id
                val wanted = event.dialogue.needs()
                needs[open] = wanted
                wanted.forEach { needing.getOrPut(it) { ConcurrentHashMap.newKeySet() } += open }
                for (requirement in wanted) {
                    failed[requirement]?.let { broke -> fail(event.houseId, requirement, because = stored, broke = broke) }
                }
            }

            is PlayerCompletedDialogue -> ended(event.houseId to event.dialogueId)
            is PlayerLostDialogue -> ended(event.houseId to event.dialogueId)
            else -> Unit
        }

        for (requirement in breaks(stored.event)) {
            failed[requirement] = stored
            needing[requirement].orEmpty().map { (house, _) -> house }.distinct().forEach { house ->
                fail(house, requirement, because = stored, broke = stored)
            }
        }
    }

    private fun ended(open: Pair<HouseId, DialogueId>) {
        needs.remove(open)?.forEach { needing[it]?.remove(open) }
    }

    private fun fail(house: HouseId, requirement: Requirement, because: StoredEvent, broke: StoredEvent) {
        val provenance = Provenance(
            commandId = UUID.fromString(because.id),
            correlationId = runCatching { UUID.fromString(broke.correlationId) }.getOrDefault(UUID.fromString(broke.id)),
        )
        later.schedule(0) {
            try {
                houses.execute(FailRequirement(house, requirement, world.today(), clock.now()), provenance)
            } catch (@Suppress("SwallowedException") wiped: HouseError.NoSuchHouse) {
                // The world was emptied in between, and the house with it.
                Unit
            }
        }
    }

    /** Forgets what it knew of, because the world it was in has been emptied. See decision 0036. */
    override fun reset() {
        needs.clear()
        needing.clear()
        failed.clear()
    }
}
