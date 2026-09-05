package villages.domain

/**
 * The rules of a house as two pure functions: decide turns a command and the current state into events,
 * evolve folds an event into the state. It depends on nothing, and everything that stores, routes or shows
 * a house is downstream of it.
 */
object HouseDecider {
    /** What a new house earns each second, until anything else in the world says otherwise. */
    const val FOUNDING_RATE = 1.0

    /**
     * How much the world thinks a new house matters: enough to see standing over the region, not enough
     * to see from the next country. A placeholder, like the rate above, until the chrono-engine judges it.
     */
    val FOUNDING_SIGNIFICANCE = Significance(20.0)

    val initial: House = House.NotFounded

    fun decide(command: HouseCommand, state: House): List<HouseEvent> = when (command) {
        is FoundHouse -> when (state) {
            is House.Founded -> throw HouseError.AlreadyFounded
            House.NotFounded -> listOf(
                HouseFounded(
                    houseId = command.houseId,
                    player = command.player,
                    name = command.name,
                    seat = command.seat,
                    significance = FOUNDING_SIGNIFICANCE,
                    banner = command.banner,
                    treasury = Treasury(amount = 0, ratePerSecond = FOUNDING_RATE, asOf = command.at),
                    at = command.at,
                ),
            )
        }
    }

    fun evolve(state: House, event: HouseEvent): House = when (event) {
        is HouseFounded -> House.Founded(
            id = event.houseId,
            player = event.player,
            name = event.name,
            seat = event.seat,
            significance = event.significance,
            banner = event.banner,
            treasury = event.treasury,
            foundedAt = event.at,
        )
    }

    /** The state after every event so far, from the beginning. */
    fun fold(events: List<HouseEvent>): House = events.fold(initial, ::evolve)
}
