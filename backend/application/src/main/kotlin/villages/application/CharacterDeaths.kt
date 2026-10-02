package villages.application

import villages.domain.CharacterDied
import villages.domain.CharacterId
import villages.domain.HouseError
import villages.domain.HouseGainedKeyFigure
import villages.domain.HouseId
import villages.domain.HouseLostKeyFigure
import java.util.concurrent.ConcurrentHashMap

/**
 * The listener for character deaths: when a character dies, every house that held them as a key figure loses them.
 *
 * The death is on the character's stream and the losses belong on the houses', and no one decision can
 * write both, so a reaction carries it, on the pattern of the pledge release. It follows the feed from the
 * beginning with a fold of its own - who holds whom, and who has died - rather than reading a read model,
 * because two subscriptions can stand at different points in the feed and a race between them is the thing
 * this exists to close. See decision record 0055.
 *
 * **Either order heals.** A death finds the houses that hold the dead; a tie made to somebody already dead
 * finds the death. Whichever of the two the feed brings second writes the loss.
 *
 * Every loss continues the death's story, and its cause is the event that set it off, so the event list reads
 * a death and its losses as one thing. It issues through `Later`, as the pledge release does, so no command
 * runs inside the feed's own callback. **It does not cancel**: a loss already written is refused by the
 * house as somebody it no longer holds, and a house gone in a wipe as a house that is not there, and both
 * refusals are swallowed, which is what makes a replay write nothing twice.
 *
 * No successor rises when a house loses its last key figure. The setting says somebody does; that waits for
 * a mechanic of its own.
 */
class CharacterDeaths(
    feed: EventFeed,
    later: Later,
    faults: Faults,
    private val keyFigures: KeyFigureService,
) : Reaction("the listener for character deaths", feed, later, faults) {
    private val holders = ConcurrentHashMap<CharacterId, MutableSet<HouseId>>()
    private val deaths = ConcurrentHashMap<CharacterId, StoredEvent>()

    override fun apply(stored: StoredEvent) {
        when (val event = stored.event) {
            is CharacterDied -> {
                deaths[event.characterId] = stored
                holders[event.characterId].orEmpty().toList().forEach { house ->
                    writeLoss(house, event.characterId, because = stored, death = stored)
                }
            }

            is HouseGainedKeyFigure -> {
                holders.getOrPut(event.characterId) { ConcurrentHashMap.newKeySet() } += event.houseId
                deaths[event.characterId]?.let { death ->
                    writeLoss(event.houseId, event.characterId, because = stored, death = death)
                }
            }

            is HouseLostKeyFigure -> holders[event.characterId]?.remove(event.houseId)

            else -> Unit
        }
    }

    private fun writeLoss(house: HouseId, character: CharacterId, because: StoredEvent, death: StoredEvent) {
        val provenance = Provenance.continuing(story = death, cause = because)
        issueLater(
            "losing ${character.stream} from ${house.stream}",
            // Lost already: by an earlier wake-up, or on a replay that has met this death before.
            settled = setOf(HouseError.NoSuchKeyFigure::class),
        ) {
            keyFigures.loseHeldBy(house, character, provenance)
        }
    }

    /** Forgets whom it knew of, because the world they were in has been emptied. See decision 0036. */
    override fun forget() {
        holders.clear()
        deaths.clear()
    }
}
