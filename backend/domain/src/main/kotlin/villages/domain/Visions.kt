package villages.domain

/**
 * What a house was given to see outright, beyond its seat and its key figures: the visions it still has, in the
 * order it was given them. The part of a founded house that decides its vision commands and folds its vision
 * events. See decision records 0061 and 0075.
 */
data class Visions(val given: List<VisionId> = emptyList()) {
    internal fun decide(command: VisionCommand): List<VisionEvent> = when (command) {
        // How far a house sees is the world's to say rather than the command's, so the size goes on the event
        // from here, and a later change to it leaves what was given as it was. See decision record 0061.
        is GiveVision -> {
            if (command.visionId in given) {
                throw HouseError.InvalidVision("this house was already given vision under that name")
            }
            listOf(
                HouseGainedVision(
                    houseId = command.houseId,
                    visionId = command.visionId,
                    place = command.place,
                    radius = Vision.MALLORCA,
                    worldTime = command.worldTime,
                    recordedAt = command.recordedAt,
                ),
            )
        }

        is TakeVision -> {
            if (command.visionId !in given) {
                throw HouseError.NoSuchVision
            }
            listOf(HouseLostVision(command.houseId, command.visionId, command.worldTime, command.recordedAt))
        }
    }

    internal fun evolve(event: VisionEvent): Visions = when (event) {
        is HouseGainedVision -> copy(given = given + event.visionId)
        is HouseLostVision -> copy(given = given - event.visionId)
    }
}
