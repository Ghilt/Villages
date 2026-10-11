package villages.application

import villages.domain.CharacterAppeared
import villages.domain.CharacterDied
import villages.domain.CharacterId
import villages.domain.CharacterStatChanged
import villages.domain.Content
import villages.domain.HouseError
import villages.domain.HouseGainedVision
import villages.domain.HouseId
import villages.domain.HouseIncomeChanged
import villages.domain.HouseLostVision
import villages.domain.IncomeSource
import villages.domain.Incomes
import villages.domain.Location
import villages.domain.Resource
import villages.domain.Stat
import villages.domain.StructureCatalogue
import villages.domain.StructureChangedHands
import villages.domain.StructureDecider
import villages.domain.StructureId
import villages.domain.StructureLevelChanged
import villages.domain.StructureRaised
import villages.domain.StructureRebuilt
import villages.domain.StructureRuined
import villages.domain.StructureSlotEmptied
import villages.domain.StructureSlotFilled
import villages.domain.StructureType
import villages.domain.VisionId
import villages.domain.Yields
import java.util.concurrent.ConcurrentHashMap

/**
 * The standing-effects listener: a house sees from, and is paid by, exactly the structures it holds, as far as each
 * one's type and level see and as much as they yield, and its own history says so. Who holds a structure is the structure's to say and what a house sees is
 * the house's, and no one decision can write both, so a reaction carries it: a structure raised for a house or
 * handed to one gives that house `gainedVision` from it, at the catalogue's radius of the moment and with `from`
 * naming it, and one handed away takes that vision back with `lostVision`. A structure that changes level changes
 * how far its holder sees from it: the new vision is given before the old is taken, so the fog never closes between
 * them. A retuned catalogue never rewrites what a
 * house saw, because what it saw is what was written.
 *
 * **And it pays.** What a structure yields its holder each month at its level, the catalogue's, is the house's
 * `incomeChanged` under the structure's own source, per second; a structure handed away, fallen or nobody's pays
 * nothing, which is the same event with no rates. What fills its slots counts, by `Yields`: so it folds the slots
 * itself, and the stats and deaths of everyone, for the people in them. What was paid is what was written, so retuning the catalogue
 * changes what is paid from the next change and never what was. See docs/plans/structures.md.
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
    private val incomes: IncomeService,
) : Reaction("the standing-effects listener", feed, later, faults) {
    /**
     * A structure as this listener needs it: what it is, where, who holds it since which of its events, the last event
     * that changed what it gives, and what is in its slots.
     */
    private data class Standing(
        val type: StructureType,
        val level: Int,
        val place: Location,
        val holder: HouseId?,
        val since: Long,
        val because: StoredEvent,
        val slots: Map<String, List<Content>> = emptyMap(),
    )

    private val structures = ConcurrentHashMap<StructureId, Standing>()

    /** A vision a house was given from a structure, and how far it sees. */
    private data class Seen(val id: VisionId, val radius: Double)

    /** The vision each house was given from each structure, still open, and the reverse, to close one by its id. */
    private val seen = ConcurrentHashMap<Pair<HouseId, StructureId>, Seen>()
    private val seenBy = ConcurrentHashMap<VisionId, Pair<HouseId, StructureId>>()

    /** What each house is paid from each structure, as its own history last said, and which structure a source is. */
    private val paid = ConcurrentHashMap<Pair<HouseId, StructureId>, Map<Resource, Double>>()
    private val sources = ConcurrentHashMap<IncomeSource, StructureId>()

    /** The stats of every person, and who has died, for the people in slots: what a slot that scales reads. */
    private val stats = ConcurrentHashMap<CharacterId, Map<Stat, Int>>()
    private val dead = ConcurrentHashMap.newKeySet<CharacterId>()

    @Volatile
    private var live = false

    override fun apply(stored: StoredEvent) {
        when (val event = stored.event) {
            is StructureRaised -> {
                sources[IncomeSource.of(event.structureId)] = event.structureId
                structures[event.structureId] =
                    Standing(event.structureType, event.level, event.place, event.holder, stored.streamVersion, stored)
                event.holder?.let { reconcile(it, event.structureId) }
            }

            is StructureChangedHands -> {
                val was = structures[event.structureId] ?: return
                structures[event.structureId] = was.copy(holder = event.to, since = stored.streamVersion, because = stored)
                event.from?.let { reconcile(it, event.structureId) }
                event.to?.let { reconcile(it, event.structureId) }
            }

            // A level changes how far its holder sees from it, from the level's own event.
            is StructureLevelChanged -> {
                val was = structures[event.structureId] ?: return
                structures[event.structureId] = was.copy(level = event.level, since = stored.streamVersion, because = stored)
                was.holder?.let { reconcile(it, event.structureId) }
            }

            // A ruin gives nothing: whoever held it sees from it no longer. Rebuilt, it gives again to whoever holds it.
            is StructureRuined -> {
                val was = structures[event.structureId] ?: return
                structures[event.structureId] = was.copy(holder = null, since = stored.streamVersion, because = stored)
                was.holder?.let { reconcile(it, event.structureId) }
            }

            is StructureRebuilt -> {
                val was = structures[event.structureId] ?: return
                structures[event.structureId] =
                    was.copy(type = event.structureType, level = event.level, holder = event.holder, since = stored.streamVersion, because = stored)
                event.holder?.let { reconcile(it, event.structureId) }
            }

            // What fills a slot changes what it pays, not who holds it, so the holding's run, and its sight, go on.
            is StructureSlotFilled -> slotted(event.structureId, stored) { slots ->
                slots + (event.slot to slots[event.slot].orEmpty() + event.content)
            }

            is StructureSlotEmptied -> slotted(event.structureId, stored) { slots ->
                StructureDecider.withOneTakenOut(slots, event.slot, event.contentId)
            }

            // A person in a slot that scales pays by their stat, and pays nothing of it dead.
            is CharacterAppeared -> stats[event.characterId] = event.stats
            is CharacterStatChanged -> {
                stats.compute(event.characterId) { _, held -> held.orEmpty() + (event.stat to event.value) }
                inSlots(event.characterId, stored)
            }
            is CharacterDied -> {
                dead += event.characterId
                inSlots(event.characterId, stored)
            }

            is HouseGainedVision -> event.from?.let { structure ->
                seen[event.houseId to structure] = Seen(event.visionId, event.radius)
                seenBy[event.visionId] = event.houseId to structure
            }

            is HouseIncomeChanged -> sources[event.source]?.let { structure ->
                if (event.ratesPerSecond.isEmpty()) paid.remove(event.houseId to structure) else paid[event.houseId to structure] = event.ratesPerSecond
            }

            // Only if it is still the one held: a level's new vision is given before the old one is taken.
            is HouseLostVision -> seenBy.remove(event.visionId)?.let { key ->
                seen.computeIfPresent(key) { _, held -> held.takeIf { it.id != event.visionId } }
            }

            else -> Unit
        }
    }

    /** The structure with its slots as [change] makes them, and its holder set right, in the story of [stored]. */
    private fun slotted(id: StructureId, stored: StoredEvent, change: (Map<String, List<Content>>) -> Map<String, List<Content>>) {
        val was = structures[id] ?: return
        structures[id] = was.copy(slots = change(was.slots), because = stored)
        was.holder?.let { reconcile(it, id) }
    }

    /** Every structure [person] is in a slot of has its holder set right, in the story of what changed them. */
    private fun inSlots(person: CharacterId, stored: StoredEvent) {
        for ((id, standing) in structures) {
            if (standing.slots.values.none { held -> held.any { it == Content.Person(person) } }) continue
            structures[id] = standing.copy(because = stored)
            standing.holder?.let { reconcile(it, id) }
        }
    }

    /** What [standing] yields its holder a month, by its type and level and what fills its slots. */
    private fun yieldsOf(standing: Standing): Map<Resource, Double> = catalogue.of(standing.type)?.let { spec ->
        Yields.of(spec, standing.level, standing.slots) { person, stat -> if (person in dead) null else stats[person]?.get(stat) }
    }.orEmpty()

    /** Sets every holding right, once the history is folded: what each structure's holder should see, and should not. */
    override fun caughtUp() {
        live = true
        for ((structure, standing) in structures) {
            standing.holder?.let { reconcile(it, structure) }
        }
        for ((house, structure) in seen.keys + paid.keys) {
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
        issueLater("setting right what ${structure.stream} pays ${house.stream}") {
            val standing = structures[structure]
            val yields = standing?.takeIf { it.holder == house }?.let(::yieldsOf)
            val wanted = Incomes.paying(yields.orEmpty().mapValues { (_, perMonth) -> perMonth / Incomes.SECONDS_A_MONTH })
            if (wanted != paid[house to structure].orEmpty()) {
                incomes.pay(house, IncomeSource.of(structure), wanted, Provenance.continuing(story = because))
            }
        }
    }

    /** Forgets every structure and every vision it knew of, because the world they were in has been emptied. */
    override fun forget() {
        structures.clear()
        seen.clear()
        seenBy.clear()
        paid.clear()
        sources.clear()
        stats.clear()
        dead.clear()
    }
}
