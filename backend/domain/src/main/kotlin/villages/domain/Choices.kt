package villages.domain

/**
 * What a house is asked: the rules of its choice commands and the fold of its choice events. Over the whole
 * house rather than a part of a founded one, because a house is asked things before it exists - where to found
 * itself is the first of them - so the choice pending is on both states. What an option does to the rest of the
 * house it asks of the house, through [Follow]. See decision records 0034 and 0075.
 */
internal object Choices {
    fun decide(command: ChoiceCommand, state: House, follow: Follow): List<HouseEvent> = when (command) {
        is GiveChoice -> {
            if (state.pending != null) {
                throw HouseError.ChoicePending
            }
            command.choice.refuseUnlessGivableTo(state)
            listOf(PlayerGivenChoice(command.houseId, command.player, command.choice, command.worldTime, command.recordedAt))
        }

        is Roll -> {
            HouseDecider.founded(state)
            if (state.pending != null) {
                throw HouseError.ChoicePending
            }
            command.hand.refuseUnlessDealtBy(command.rarity, command.omens)
            command.hand.refuseUnlessGivableTo(state)

            // The roll, its price and its hand come out of one decision, so none is ever seen without the
            // others. A price the house cannot pay is refused by the spend, and the whole roll with it.
            listOf(
                PlayerRolled(
                    houseId = command.houseId,
                    player = command.player,
                    rollId = command.rollId,
                    omens = command.omens,
                    rarity = command.rarity,
                    landing = command.landing,
                    circleKm = command.circleKm,
                    worldTime = command.worldTime,
                    recordedAt = command.recordedAt,
                ),
            ) + follow.follow(listOf(command.price), command.player, command.worldTime, command.recordedAt) +
                PlayerGivenChoice(command.houseId, command.player, command.hand, command.worldTime, command.recordedAt)
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
            ) + follow.follow(listOf(taken.effect), command.player, command.worldTime, command.recordedAt)
        }
    }

    fun evolve(state: House, event: ChoiceEvent): House = when (event) {
        is PlayerRolled -> state
        is PlayerGivenChoice -> state.asked(event.choice)
        is PlayerTookAction -> state.asked(null)
    }

    private fun House.asked(choice: Choice?): House = when (this) {
        is House.NotFounded -> copy(pending = choice)
        is House.Founded -> copy(pending = choice)
    }
}
