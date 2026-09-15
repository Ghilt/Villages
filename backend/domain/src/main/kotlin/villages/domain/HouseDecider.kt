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

    val initial: House = House.NotFounded()

    fun decide(command: HouseCommand, state: House): List<HouseEvent> = when (command) {
        is FoundHouse -> when (state) {
            is House.Founded -> throw HouseError.AlreadyFounded
            is House.NotFounded -> listOf(founding(command))
        }

        is GiveChoice -> {
            if (state.pending != null) {
                throw HouseError.ChoicePending
            }
            // A choice that would found the house is meaningless once it is founded. Which effects a
            // state can be offered is the decider's business, not the giver's.
            if (state is House.Founded && command.choice.options.any { it.effect is Effect.FoundAt }) {
                throw HouseError.AlreadyFounded
            }
            listOf(
                HouseGivenChoice(
                    houseId = command.houseId,
                    player = command.player,
                    choice = command.choice,
                    worldTime = command.worldTime,
                    recordedAt = command.recordedAt,
                ),
            )
        }

        is TakeAction -> {
            val pending = state.pending ?: throw HouseError.NoChoicePending
            if (pending.id != command.choiceId) {
                throw HouseError.NoSuchChoice
            }
            val taken = pending.option(command.optionId) ?: throw HouseError.NoSuchOption

            // The action and what it does come out of one decision, so they are appended together and
            // are never seen apart. See decision record 0034.
            listOf(
                HouseTookAction(
                    houseId = command.houseId,
                    player = command.player,
                    choiceId = command.choiceId,
                    optionId = command.optionId,
                    worldTime = command.worldTime,
                    recordedAt = command.recordedAt,
                ),
            ) + follows(taken.effect, command, state)
        }
    }

    /** What an option's effect records, beyond the action itself. */
    private fun follows(effect: Effect, command: TakeAction, state: House): List<HouseEvent> = when (effect) {
        is Effect.FoundAt -> when (state) {
            is House.Founded -> throw HouseError.AlreadyFounded
            is House.NotFounded -> listOf(
                HouseFounded(
                    houseId = command.houseId,
                    player = command.player,
                    name = effect.name,
                    seat = effect.seat,
                    significance = FOUNDING_SIGNIFICANCE,
                    banner = effect.banner,
                    treasury = Treasury(amount = 0, ratePerSecond = FOUNDING_RATE, asOf = command.recordedAt),
                    worldTime = command.worldTime,
                    recordedAt = command.recordedAt,
                ),
            )
        }
    }

    private fun founding(command: FoundHouse): HouseFounded = HouseFounded(
        houseId = command.houseId,
        player = command.player,
        name = command.name,
        seat = command.seat,
        significance = FOUNDING_SIGNIFICANCE,
        banner = command.banner,
        treasury = Treasury(amount = 0, ratePerSecond = FOUNDING_RATE, asOf = command.recordedAt),
        worldTime = command.worldTime,
        recordedAt = command.recordedAt,
    )

    fun evolve(state: House, event: HouseEvent): House = when (event) {
        is HouseFounded -> House.Founded(
            id = event.houseId,
            player = event.player,
            name = event.name,
            seat = event.seat,
            significance = event.significance,
            banner = event.banner,
            treasury = event.treasury,
            foundedOn = event.worldTime,
            foundedAt = event.recordedAt,
            // Founding by any means settles a choice that was about founding: a house founded from the
            // debug button or by a seed has no use for a parchment asking where to put itself. A choice
            // about anything else is still open, and survives. See decision record 0034.
            pending = state.pending?.takeUnless { choice ->
                choice.options.any { it.effect is Effect.FoundAt }
            },
        )

        is HouseGivenChoice -> when (state) {
            is House.NotFounded -> state.copy(pending = event.choice)
            is House.Founded -> state.copy(pending = event.choice)
        }

        is HouseTookAction -> when (state) {
            is House.NotFounded -> state.copy(pending = null)
            is House.Founded -> state.copy(pending = null)
        }
    }

    /** The state after every event so far, from the beginning. */
    fun fold(events: List<HouseEvent>): House = events.fold(initial, ::evolve)
}
