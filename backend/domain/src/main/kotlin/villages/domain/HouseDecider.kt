package villages.domain

import java.time.Instant

/**
 * The rules of a house as two pure functions: decide turns a command and the current state into events,
 * evolve folds an event into the state. It depends on nothing, and everything that stores, routes or shows
 * a house is downstream of it.
 */
object HouseDecider : Decider<HouseCommand, House, HouseEvent> {
    /**
     * How much the world thinks a new house matters: enough to see standing over the region, not enough
     * to see from the next country. A placeholder, like the rate above, until the chrono-engine judges it.
     */
    val FOUNDING_SIGNIFICANCE = Significance(20.0)

    /** How many key figures a house can hold: the three by three the pane shows them in. See decision 0055. */
    const val MOST_KEY_FIGURES = 9

    override val initial: House = House.NotFounded()

    override fun decide(command: HouseCommand, state: House): List<HouseEvent> = when (command) {
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
                PlayerGivenChoice(
                    houseId = command.houseId,
                    player = command.player,
                    choice = command.choice,
                    worldTime = command.worldTime,
                    recordedAt = command.recordedAt,
                ),
            )
        }

        is GrantResource -> {
            founded(state)
            anAmount(command.amount)
            // Nothing else is checked: what a house may be given, and by what, is a mechanic and not a shape.
            listOf(
                HouseResourceGranted(
                    houseId = command.houseId,
                    resource = command.resource,
                    amount = command.amount,
                    worldTime = command.worldTime,
                    recordedAt = command.recordedAt,
                ),
            )
        }

        is SpendResource -> {
            val house = founded(state)
            anAmount(command.amount)
            enough(house, command.resource, command.amount, command.recordedAt)
            listOf(
                HouseResourceSpent(
                    houseId = command.houseId,
                    resource = command.resource,
                    amount = command.amount,
                    worldTime = command.worldTime,
                    recordedAt = command.recordedAt,
                ),
            )
        }

        is PledgeResource -> {
            val house = founded(state)
            anAmount(command.amount)
            if (command.until <= command.worldTime) {
                throw HouseError.InvalidPledge("a pledge comes back after it is made, not before")
            }
            if (command.purpose.isBlank()) {
                throw HouseError.InvalidPledge("a pledge is for something")
            }
            if (house.pledges.any { it.id == command.pledgeId }) {
                throw HouseError.InvalidPledge("this house has already pledged under that name")
            }
            // Against what is free, not against what there is: twice-pledged reason is reason that was
            // never there. This is the one rule that makes a pledge different from a note in the margin.
            enough(house, command.resource, command.amount, command.recordedAt)
            listOf(
                HouseResourcePledged(
                    houseId = command.houseId,
                    pledgeId = command.pledgeId,
                    resource = command.resource,
                    amount = command.amount,
                    until = command.until,
                    purpose = command.purpose,
                    worldTime = command.worldTime,
                    recordedAt = command.recordedAt,
                ),
            )
        }

        is ReleasePledge -> {
            val house = founded(state)
            if (house.pledges.none { it.id == command.pledgeId }) {
                throw HouseError.NoSuchPledge
            }
            listOf(
                HouseResourceReleased(
                    houseId = command.houseId,
                    pledgeId = command.pledgeId,
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
                PlayerTookAction(
                    houseId = command.houseId,
                    player = command.player,
                    choiceId = command.choiceId,
                    optionId = command.optionId,
                    worldTime = command.worldTime,
                    recordedAt = command.recordedAt,
                ),
            ) + follows(taken.effect, command, state)
        }

        is TakeKeyFigure -> {
            val house = founded(state)
            if (command.characterId in house.keyFigures) {
                throw HouseError.AlreadyAKeyFigure
            }
            if (house.keyFigures.size >= MOST_KEY_FIGURES) {
                throw HouseError.TooManyKeyFigures
            }
            listOf(HouseGainedKeyFigure(command.houseId, command.characterId, command.worldTime, command.recordedAt))
        }

        is LoseKeyFigure -> {
            if (command.characterId !in founded(state).keyFigures) {
                throw HouseError.NoSuchKeyFigure
            }
            listOf(HouseLostKeyFigure(command.houseId, command.characterId, command.worldTime, command.recordedAt))
        }

        // The two commands that can only be refused. Nothing happens to the house either way, so nothing is
        // written, and the refusal is the whole of the answer. See decision record 0055.
        is ActThrough -> {
            if (command.characterId !in founded(state).keyFigures) {
                throw HouseError.NoSuchKeyFigure
            }
            emptyList()
        }

        is CheckRoomForKeyFigure -> {
            if (founded(state).keyFigures.size >= MOST_KEY_FIGURES) {
                throw HouseError.TooManyKeyFigures
            }
            emptyList()
        }
    }

    /** A house that exists, or the refusal. Everything a resource is done to needs one. */
    private fun founded(state: House): House.Founded =
        state as? House.Founded ?: throw HouseError.NoSuchHouse

    private fun anAmount(amount: Long) {
        if (amount <= 0) {
            throw HouseError.InvalidAmount("an amount is more than nothing, and $amount is not")
        }
    }

    private fun enough(house: House.Founded, resource: Resource, wanted: Long, now: Instant) {
        if (!house.has(resource, wanted, now)) {
            throw HouseError.NotEnoughFree(resource, wanted, house.freeOf(resource, now))
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
                    resources = emptyStocks(command.recordedAt),
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
        resources = emptyStocks(command.recordedAt),
        worldTime = command.worldTime,
        recordedAt = command.recordedAt,
    )

    override fun evolve(state: House, event: HouseEvent): House = when (event) {
        is HouseFounded -> House.Founded(
            id = event.houseId,
            player = event.player,
            name = event.name,
            seat = event.seat,
            significance = event.significance,
            banner = event.banner,
            resources = event.resources,
            foundedOn = event.worldTime,
            foundedAt = event.recordedAt,
            // Founding by any means settles a choice that was about founding: a house founded from the
            // debug button or by a seed has no use for a parchment asking where to put itself. A choice
            // about anything else is still open, and survives. See decision record 0034.
            pending = state.pending?.takeUnless { choice ->
                choice.options.any { it.effect is Effect.FoundAt }
            },
        )

        // A resource event on a house that does not exist cannot be reached: the decider refuses every
        // command that would write one. Evolve is total anyway, because a fold must never throw.
        is HouseResourceGranted -> when (state) {
            is House.NotFounded -> state
            is House.Founded -> state.withStock(event.resource) { it.plus(event.amount, event.recordedAt) }
        }

        is HouseResourceSpent -> when (state) {
            is House.NotFounded -> state
            is House.Founded -> state.withStock(event.resource) { it.minus(event.amount, event.recordedAt) }
        }

        is HouseResourcePledged -> when (state) {
            is House.NotFounded -> state
            is House.Founded -> state.copy(
                pledges = state.pledges + Pledge(
                    id = event.pledgeId,
                    resource = event.resource,
                    amount = event.amount,
                    until = event.until,
                    purpose = event.purpose,
                ),
            )
        }

        // Nothing is added back, because nothing was taken away: what is pledged is the sum of this list,
        // so dropping the pledge is the whole of the release.
        is HouseResourceReleased -> when (state) {
            is House.NotFounded -> state
            is House.Founded -> state.copy(pledges = state.pledges.filterNot { it.id == event.pledgeId })
        }

        is PlayerGivenChoice -> when (state) {
            is House.NotFounded -> state.copy(pending = event.choice)
            is House.Founded -> state.copy(pending = event.choice)
        }

        is PlayerTookAction -> when (state) {
            is House.NotFounded -> state.copy(pending = null)
            is House.Founded -> state.copy(pending = null)
        }

        is HouseGainedKeyFigure -> when (state) {
            is House.NotFounded -> state
            is House.Founded -> state.copy(keyFigures = state.keyFigures + event.characterId)
        }

        is HouseLostKeyFigure -> when (state) {
            is House.NotFounded -> state
            is House.Founded -> state.copy(keyFigures = state.keyFigures - event.characterId)
        }
    }
}
