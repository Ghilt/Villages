package villages.domain

import java.time.Instant

/**
 * Everything that happens to a structure, on its own stream. The world's half: typed
 * `villages.structure.<verb>.v<n>`, and every one carries the two times. See decision record 0092.
 */
sealed interface StructureEvent : Event {
    val structureId: StructureId
}

/**
 * A structure came to be: of a type, at a level, at a place, under a name, held by a house or by nobody.
 *
 * Its significance is the catalogue's for the type at that level, carried on the event so that how far out it is
 * drawn is a fact of its history (0026) rather than of a catalogue that may have been retuned since.
 */
data class StructureRaised(
    override val structureId: StructureId,
    val structureType: StructureType,
    val name: String,
    val place: Location,
    val significance: Significance,
    val level: Int,
    /** The house that holds it, or nobody. A faction will be a second kind of holder, and a version of this event. */
    val holder: HouseId?,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : StructureEvent, WorldEvent

/**
 * A structure passed from one holder to another, a house or nobody on either side. One fact, and the only one on the
 * structure: what it changes for the two houses - what they are paid, what they see, a seat lost - is written after it
 * by listeners, in the same story. See docs/plans/structures.md.
 */
/**
 * A structure fell to ruin, for the cause given. A ruin has no holder and gives nothing: whoever held it holds it no
 * longer, and what that means for them - what they see, a seat lost - follows from listeners, in the same story. Its
 * contents stay in it until something takes them out. See docs/plans/structures.md.
 */
data class StructureRuined(
    override val structureId: StructureId,
    val cause: String,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : StructureEvent, WorldEvent

/**
 * A ruin was raised again: of a type, at a level, for a house or for nobody, its significance the catalogue's for
 * that type and level, carried as a raising's is (0026). The same structure, its name and place unchanged.
 */
data class StructureRebuilt(
    override val structureId: StructureId,
    val structureType: StructureType,
    val level: Int,
    val significance: Significance,
    val holder: HouseId?,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : StructureEvent, WorldEvent

/**
 * A structure went up or down to [level], its significance the catalogue's for its type at that level, carried as a
 * raising's is (0026). What it gives its holder - how far they see from it, later what it pays - follows from
 * listeners, in the same story. See docs/plans/structures.md.
 */
data class StructureLevelChanged(
    override val structureId: StructureId,
    val level: Int,
    val significance: Significance,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : StructureEvent, WorldEvent

/**
 * A person or an item was put in a place of one of the structure's slots, after whatever was in it already. What it
 * changes for the holder follows from listeners, in the same story. See docs/plans/structures.md.
 */
data class StructureSlotFilled(
    override val structureId: StructureId,
    val slot: String,
    val content: Content,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : StructureEvent, WorldEvent

/** One content was taken out of a slot, and the rest stay as they were. What it was is on the event that put it in. */
data class StructureSlotEmptied(
    override val structureId: StructureId,
    val slot: String,
    val contentId: ContentId,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : StructureEvent, WorldEvent

data class StructureChangedHands(
    override val structureId: StructureId,
    val from: HouseId?,
    val to: HouseId?,
    override val worldTime: WorldTime,
    override val recordedAt: Instant,
) : StructureEvent, WorldEvent
