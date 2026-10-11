package villages.domain

/**
 * A structure's rules, decided against its own history and the catalogue. A class rather than an object, because
 * what a type is - its levels, and how far out each is drawn - is the catalogue's, and the catalogue is read when
 * the server starts: every decision of a running server reads the same one. See decision record 0092.
 */
class StructureDecider(private val catalogue: StructureCatalogue) : Decider<StructureCommand, Structure, StructureEvent> {
    override val initial: Structure = Structure.NotRaised

    override fun decide(command: StructureCommand, state: Structure): List<StructureEvent> = when (command) {
        is RaiseStructure -> {
            if (state is Structure.Raised) {
                throw StructureError.AlreadyRaised
            }
            val spec = catalogue.of(command.structureType) ?: throw StructureError.NoSuchType(command.structureType)
            if (command.level !in 1..spec.highest) {
                throw StructureError.InvalidLevel("a ${command.structureType} rises from 1 to ${spec.highest}, not ${command.level}")
            }
            if (command.name.isBlank() || command.name.length > LONGEST_NAME) {
                throw StructureError.InvalidName("a name of 1 to $LONGEST_NAME characters, not '${command.name}'")
            }
            listOf(
                StructureRaised(
                    structureId = command.structureId,
                    structureType = command.structureType,
                    name = command.name.trim(),
                    place = command.place,
                    significance = spec.at(command.level).significance,
                    level = command.level,
                    holder = command.holder,
                    worldTime = command.worldTime,
                    recordedAt = command.recordedAt,
                ),
            )
        }
        // One holder at a time, held here at the instant of the decision: nothing else says who holds it.
        is HandOver -> {
            if (state !is Structure.Raised) {
                throw StructureError.NoSuchStructure
            }
            if (state.ruined) {
                throw StructureError.IsARuin
            }
            if (state.holder == command.to) {
                throw StructureError.SameHolder
            }
            listOf(StructureChangedHands(command.structureId, state.holder, command.to, command.worldTime, command.recordedAt))
        }
        // Within the levels its type has, and never for a ruin, which has no level to change until it is rebuilt.
        is ChangeLevel -> {
            val standing = state as? Structure.Raised ?: throw StructureError.NoSuchStructure
            if (standing.ruined) {
                throw StructureError.IsARuin
            }
            val spec = catalogue.of(standing.type) ?: throw StructureError.NoSuchType(standing.type)
            val level = standing.level + command.by
            if (command.by == 0 || level !in 1..spec.highest) {
                throw StructureError.InvalidLevel("a ${standing.type} at level ${standing.level} goes from 1 to ${spec.highest}, not to $level")
            }
            // Not lowered under what a slot holds: whatever no longer fits is taken out first.
            spec.slots.firstOrNull { (standing.slots[it.name]?.size ?: 0) > it.placesAt(level) }?.let { crowded ->
                throw StructureError.InvalidLevel("the ${crowded.name} holds more than level $level has room for; empty it first")
            }
            listOf(StructureLevelChanged(command.structureId, level, spec.at(level).significance, command.worldTime, command.recordedAt))
        }
        // Strict about how many, at the level it stands at, and about once each; permissive about what.
        is FillSlot -> {
            val standing = state as? Structure.Raised ?: throw StructureError.NoSuchStructure
            if (standing.ruined) {
                throw StructureError.IsARuin
            }
            val spec = catalogue.of(standing.type) ?: throw StructureError.NoSuchType(standing.type)
            val slot = spec.slots.firstOrNull { it.name == command.slot } ?: throw StructureError.NoSuchSlot(command.slot)
            (command.content as? Content.Item)?.let(::anItem)
            if (standing.holds(command.content.id)) {
                throw StructureError.AlreadyInSlot
            }
            if ((standing.slots[slot.name]?.size ?: 0) >= slot.placesAt(standing.level)) {
                throw StructureError.SlotFull(slot.name)
            }
            listOf(StructureSlotFilled(command.structureId, slot.name, command.content, command.worldTime, command.recordedAt))
        }
        // A ruin keeps what is in it until something takes it out: a relic under the rubble is a story.
        is EmptySlot -> {
            val standing = state as? Structure.Raised ?: throw StructureError.NoSuchStructure
            if (standing.slots[command.slot].orEmpty().none { it.id == command.contentId }) {
                throw StructureError.NotInSlot
            }
            listOf(StructureSlotEmptied(command.structureId, command.slot, command.contentId, command.worldTime, command.recordedAt))
        }
        // A ruin has no holder, cannot change hands and has no level to change: held here, at once.
        is Ruin -> {
            val standing = state as? Structure.Raised ?: throw StructureError.NoSuchStructure
            if (standing.ruined) {
                throw StructureError.IsARuin
            }
            listOf(StructureRuined(command.structureId, command.cause.trim(), command.worldTime, command.recordedAt))
        }
        is Rebuild -> {
            val ruin = state as? Structure.Raised ?: throw StructureError.NoSuchStructure
            if (!ruin.ruined) {
                throw StructureError.NotARuin
            }
            val type = command.structureType ?: ruin.type
            val spec = catalogue.of(type) ?: throw StructureError.NoSuchType(type)
            if (command.level !in 1..spec.highest) {
                throw StructureError.InvalidLevel("a $type rises from 1 to ${spec.highest}, not ${command.level}")
            }
            listOf(
                StructureRebuilt(
                    command.structureId, type, command.level, spec.at(command.level).significance, command.holder,
                    command.worldTime, command.recordedAt,
                ),
            )
        }
    }

    override fun evolve(state: Structure, event: StructureEvent): Structure = when (event) {
        is StructureRaised -> Structure.Raised(
            id = event.structureId,
            type = event.structureType,
            name = event.name,
            place = event.place,
            significance = event.significance,
            level = event.level,
            holder = event.holder,
            raisedOn = event.worldTime,
        )
        is StructureChangedHands -> (state as? Structure.Raised)?.copy(holder = event.to) ?: state
        is StructureLevelChanged -> (state as? Structure.Raised)?.copy(level = event.level, significance = event.significance) ?: state
        is StructureSlotFilled -> (state as? Structure.Raised)?.let {
            it.copy(slots = it.slots + (event.slot to it.slots[event.slot].orEmpty() + event.content))
        } ?: state
        is StructureSlotEmptied -> (state as? Structure.Raised)?.let {
            it.copy(slots = withOneTakenOut(it.slots, event.slot, event.contentId))
        } ?: state
        is StructureRuined -> (state as? Structure.Raised)?.copy(holder = null, ruined = true) ?: state
        is StructureRebuilt -> (state as? Structure.Raised)?.copy(
            type = event.structureType, level = event.level, significance = event.significance,
            holder = event.holder, ruined = false,
        ) ?: state
    }

    private fun anItem(item: Content.Item) {
        if (item.name.isBlank() || item.name.length > Content.LONGEST_NAME) {
            throw StructureError.InvalidContent("a name of 1 to ${Content.LONGEST_NAME} characters, not '${item.name}'")
        }
        if (item.about.length > Content.LONGEST_ABOUT) {
            throw StructureError.InvalidContent("a line about it of at most ${Content.LONGEST_ABOUT} characters")
        }
    }

    companion object {
        /** The slots with one content taken out of one, and a slot left with nothing in it gone. */
        fun withOneTakenOut(slots: Map<String, List<Content>>, slot: String, content: ContentId): Map<String, List<Content>> {
            val held = slots[slot].orEmpty()
            val at = held.indexOfFirst { it.id == content }
            if (at < 0) return slots
            val left = held.filterIndexed { index, _ -> index != at }
            return if (left.isEmpty()) slots - slot else slots + (slot to left)
        }

        /** Longer than any name a chronicle gives a building; the bound is there so a name cannot be a page. */
        const val LONGEST_NAME = 80
    }
}
