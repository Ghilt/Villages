package villages.gateway

import villages.application.CharacterById
import villages.application.StructureFace
import villages.application.StructureRow
import villages.domain.CharacterId
import villages.domain.Content
import villages.domain.HouseId
import villages.domain.SeenBy
import villages.domain.StructureCatalogue
import villages.domain.Yields
import villages.domain.id
import villages.protocol.ContentView
import villages.protocol.SlotView

/**
 * What a house is shown of a structure's slots, never as last seen: its holder sees into every one, another house
 * that sees the structure now into the ones the catalogue calls public, and of the rest only how many places they
 * have, each a question; with the fog lifted, everything. A person is said by their name and portrait, an item by
 * what it is. Asked only for a structure seen now, on the live day: out of sight, or on a day gone by, there is
 * nothing to show, because what is in a slot is only ever now. See docs/plans/structures.md.
 */
internal class SlotsSeen(private val catalogue: StructureCatalogue?, private val people: CharacterById) {
    /** The slots of [row] in [face] as [viewer] is shown them, every one with [everything]; null for a type with none. */
    fun of(row: StructureRow, face: StructureFace, viewer: HouseId?, everything: Boolean): List<SlotView>? {
        val spec = catalogue?.of(face.type) ?: return null
        if (spec.slots.isEmpty()) return null
        val own = everything || (viewer != null && face.holder?.house == viewer)
        return spec.slots.map { slot ->
            val held = row.slots[slot.name].orEmpty()
            SlotView(
                name = slot.name,
                places = slot.placesAt(face.level),
                contents = if (own || slot.seenBy == SeenBy.ALL) held.map(::viewOf) else null,
            )
        }
    }

    /**
     * What [row] in [face] yields its holder a month, by resource on the wire, for its holder alone, and with the fog
     * lifted: the same rule the house is paid by, so the holder reads what it is paid. Null for anybody else and for a
     * ruin, which gives nothing.
     */
    fun yieldsOf(row: StructureRow, face: StructureFace, viewer: HouseId?, everything: Boolean): Map<String, Double>? {
        if (face.ruin || !(everything || (viewer != null && face.holder?.house == viewer))) return null
        val spec = catalogue?.of(face.type) ?: return null
        return Yields.of(spec, face.level, row.slots) { person, stat ->
            people.ofCharacter(person)?.takeIf { it.diedOn == null }?.stats?.get(stat)
        }.mapKeys { (resource, _) -> resource.toWire() }
    }

    private fun viewOf(content: Content): ContentView = when (content) {
        is Content.Person -> people.ofCharacter(content.characterId).let { person ->
            ContentView(
                kind = PERSON,
                id = content.id.value.toString(),
                name = person?.let { "${it.name.given} ${it.name.family}" } ?: SOMEONE,
                portrait = person?.portrait,
            )
        }
        is Content.Item -> ContentView(
            kind = ITEM,
            id = content.id.value.toString(),
            name = content.name,
            about = content.about.ifBlank { null },
            amount = content.amount,
        )
    }

    companion object {
        const val PERSON = "person"
        const val ITEM = "item"

        /** A person the read model has not heard of: somebody, but not known by name. */
        const val SOMEONE = "someone"

        /** Shows no slots at all: a gateway made without the catalogue. */
        val NONE = SlotsSeen(null) { _: CharacterId -> null }
    }
}
