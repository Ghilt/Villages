package villages.application

import villages.domain.HouseError
import villages.domain.HouseGainedVision
import villages.domain.HouseId
import villages.domain.HouseLostVision
import villages.domain.Location
import villages.domain.StructureCatalogue
import villages.domain.StructureChangedHands
import villages.domain.StructureLevelChanged
import villages.domain.StructureRebuilt
import villages.domain.StructureRuined
import villages.domain.StructureId
import villages.domain.StructureRaised
import villages.domain.StructureType
import villages.domain.VisionId
import java.util.concurrent.ConcurrentHashMap

/**
 * The standing-effects listener: a house sees from exactly the structures it holds, as far as each one's type and
 * level see, and its own history says so. Who holds a structure is the structure's to say and what a house sees is
 * the house's, and no one decision can write both, so a reaction carries it: a structure raised for a house or
 * handed to one gives that house `gainedVision` from it, at the catalogue's radius of the moment and with `from`
 * naming it, and one handed away takes that vision back with `lostVision`. A structure that changes level changes
 * how far its holder sees from it: the new vision is given before the old is taken, so the fog never closes between
 * them. A retuned catalogue never rewrites what a
 * house saw, because what it saw is what was written. Income joins it in a later step. See docs/plans/structures.md.
 *
 * **It reconciles rather than replays.** For a house and a structure it plans one thing - set this right - and works
 * out what is right when that runs, from its own fold at that moment: the vision the house should have from the
 * structure against the one it has. So a change of hands comes right in either order, and nothing is written twice.
 * **It writes nothing while the history replays**: the past already holds what it did, and acting on it as it went
 * by would give again what was since taken away. Once caught up it sets every holding right at once.
 *
 * Its fold is its own, of the structures and of the visions their holders were given from them, because two
 * subscriptions can stand at different points in the feed and a race between them is the thing this exists to close.
 */
class StandingEffects(
    feed: EventFeed,
    later: Later,
    faults: Faults,
    private val catalogue: StructureCatalogue,
    private val visions: VisionService,
) : Reaction("the standing-effects listener", feed, later, faults) {
    /** A structure as this listener needs it: what it is, where, who holds it since which of its events, and that event. */
    private class Standing(
        val type: StructureType,
        val level: Int,
        val place: Location,
        val holder: HouseId?,
        val since: Long,
        val because: StoredEvent,
    )

    private val structures = ConcurrentHashMap<StructureId, Standing>()

    /** A vision a house was given from a structure, and how far it sees. */
    private data class Seen(val id: VisionId, val radius: Double)

    /** The vision each house was given from each structure, still open, and the reverse, to close one by its id. */
    private val seen = ConcurrentHashMap<Pair<HouseId, StructureId>, Seen>()
    private val seenBy = ConcurrentHashMap<VisionId, Pair<HouseId, StructureId>>()

    @Volatile
    private var live = false

    override fun apply(stored: StoredEvent) {
        when (val event = stored.event) {
            is StructureRaised -> {
                structures[event.structureId] =
                    Standing(event.structureType, event.level, event.place, event.holder, stored.streamVersion, stored)
                event.holder?.let { reconcile(it, event.structureId) }
            }

            is StructureChangedHands -> {
                val was = structures[event.structureId] ?: return
                structures[event.structureId] = Standing(was.type, was.level, was.place, event.to, stored.streamVersion, stored)
                event.from?.let { reconcile(it, event.structureId) }
                event.to?.let { reconcile(it, event.structureId) }
            }

            // A level changes how far its holder sees from it, from the level's own event.
            is StructureLevelChanged -> {
                val was = structures[event.structureId] ?: return
                structures[event.structureId] = Standing(was.type, event.level, was.place, was.holder, stored.streamVersion, stored)
                was.holder?.let { reconcile(it, event.structureId) }
            }

            // A ruin gives nothing: whoever held it sees from it no longer. Rebuilt, it gives again to whoever holds it.
            is StructureRuined -> {
                val was = structures[event.structureId] ?: return
                structures[event.structureId] = Standing(was.type, was.level, was.place, null, stored.streamVersion, stored)
                was.holder?.let { reconcile(it, event.structureId) }
            }

            is StructureRebuilt -> {
                val was = structures[event.structureId] ?: return
                structures[event.structureId] =
                    Standing(event.structureType, event.level, was.place, event.holder, stored.streamVersion, stored)
                event.holder?.let { reconcile(it, event.structureId) }
            }

            is HouseGainedVision -> event.from?.let { structure ->
                seen[event.houseId to structure] = Seen(event.visionId, event.radius)
                seenBy[event.visionId] = event.houseId to structure
            }

            // Only if it is still the one held: a level's new vision is given before the old one is taken.
            is HouseLostVision -> seenBy.remove(event.visionId)?.let { key ->
                seen.computeIfPresent(key) { _, held -> held.takeIf { it.id != event.visionId } }
            }

            else -> Unit
        }
    }

    /** Sets every holding right, once the history is folded: what each structure's holder should see, and should not. */
    override fun caughtUp() {
        live = true
        for ((structure, standing) in structures) {
            standing.holder?.let { reconcile(it, structure) }
        }
        for ((house, structure) in seen.keys) {
            reconcile(house, structure)
        }
    }

    private fun reconcile(house: HouseId, structure: StructureId) {
        if (!live) {
            return
        }
        val because = structures[structure]?.because ?: return
        issueLater(
            "setting right what ${structure.stream} lets ${house.stream} see",
            // Given already under that id, or taken already: an earlier run of this, or a replay that met it before.
            settled = setOf(HouseError.InvalidVision::class, HouseError.NoSuchVision::class),
        ) {
            val standing = structures[structure]
            val radius = standing?.takeIf { it.holder == house }?.let { catalogue.of(it.type)?.at(it.level)?.sightKm }
            val has = seen[house to structure]
            val provenance = Provenance.continuing(story = because)
            if (radius == null && has != null) {
                visions.takeFrom(house, has.id, provenance)
            } else if (radius != null && has?.radius != radius) {
                visions.giveFrom(house, structure, VisionId.seenFrom(structure, house, standing.since), standing.place, radius, provenance)
                has?.let { visions.takeFrom(house, it.id, provenance) }
            }
        }
    }

    /** Forgets every structure and every vision it knew of, because the world they were in has been emptied. */
    override fun forget() {
        structures.clear()
        seen.clear()
        seenBy.clear()
    }
}
