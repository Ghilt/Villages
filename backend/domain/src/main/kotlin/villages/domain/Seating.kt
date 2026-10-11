package villages.domain

/**
 * The house's seat: which of its holdings plays that role - where the eye goes and the room is entered - and whether
 * one was ever named. The part of a founded house that decides its seat commands and folds its seat events. Holding
 * is the structure's to say, so a house names a seat without asking whether it holds it; that its seat is one of its
 * holdings is put right a moment after, by a listener. See decision records 0075 and 0092.
 */
data class Seating(val structure: StructureId? = null, val everNamed: Boolean = false) {
    internal fun decide(command: SeatCommand): List<SeatEvent> = when (command) {
        // The founding castle is named once, whatever is replayed: a founding heard again must not name it twice.
        is NameSeat -> {
            if (everNamed) {
                throw HouseError.SeatNamedBefore
            }
            listOf(HouseNamedSeat(command.houseId, command.structureId, command.worldTime, command.recordedAt))
        }
        // Only the seat it has can be lost, so a loss heard again, or of another structure, writes nothing.
        is LoseSeat -> {
            if (structure != command.structureId) {
                throw HouseError.NoSeat
            }
            listOf(HouseLostSeat(command.houseId, command.structureId, command.worldTime, command.recordedAt))
        }
    }

    internal fun evolve(event: SeatEvent): Seating = when (event) {
        is HouseNamedSeat -> copy(structure = event.structureId, everNamed = true)
        is HouseLostSeat -> copy(structure = null)
    }
}
