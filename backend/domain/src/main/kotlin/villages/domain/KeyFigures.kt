package villages.domain

/**
 * Whom a house holds: the characters it acts through, in the order it took them in, a tie in the house's own
 * history and never in theirs. The part of a founded house that decides its key-figure commands and folds its
 * key-figure events. See decision records 0055 and 0075.
 */
data class KeyFigures(
    /** At most [HouseDecider.MOST_KEY_FIGURES], and never the same character twice. */
    val held: List<CharacterId> = emptyList(),
) {
    internal fun decide(command: KeyFigureCommand): List<KeyFigureEvent> = when (command) {
        is TakeKeyFigure -> {
            if (command.characterId in held) {
                throw HouseError.AlreadyAKeyFigure
            }
            roomForOneMore()
            listOf(HouseGainedKeyFigure(command.houseId, command.characterId, command.worldTime, command.recordedAt))
        }

        is LoseKeyFigure -> {
            holds(command.characterId)
            listOf(HouseLostKeyFigure(command.houseId, command.characterId, command.worldTime, command.recordedAt))
        }

        // The two commands that can only be refused. Nothing happens to the house either way, so nothing is
        // written, and the refusal is the whole of the answer. See decision record 0055.
        is ActThrough -> {
            holds(command.characterId)
            emptyList()
        }

        is CheckRoomForKeyFigure -> {
            roomForOneMore()
            emptyList()
        }
    }

    internal fun evolve(event: KeyFigureEvent): KeyFigures = when (event) {
        is HouseGainedKeyFigure -> copy(held = held + event.characterId)
        is HouseLostKeyFigure -> copy(held = held - event.characterId)
    }

    private fun holds(character: CharacterId) {
        if (character !in held) {
            throw HouseError.NoSuchKeyFigure
        }
    }

    private fun roomForOneMore() {
        if (held.size >= HouseDecider.MOST_KEY_FIGURES) {
            throw HouseError.TooManyKeyFigures
        }
    }
}
