package villages.domain

/**
 * The rules of a house as two pure functions: decide turns a command and the current state into events,
 * evolve folds an event into the state. It depends on nothing, and everything that stores, routes or shows
 * a house is downstream of it.
 *
 * It decides the founding itself and routes everything else. Each family of commands goes to the part of the
 * house that decides it - what it has to the [Treasury], whom it holds to [KeyFigures], what it sees to
 * [Visions], which holding is its seat to [Seating], what it is told to [Dialogues], and what it is asked to [Choices] - and each family of events to the
 * part that folds it. A part is handed a [Follow] for the effects it asks of the rest of the house, which is the
 * only way one part reaches another. See decision record 0075.
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

    override fun decide(command: HouseCommand, state: House): List<HouseEvent> {
        // What an option or a line does is decided against this house, as the effects before it left it.
        val follow = Follow { effects, player, worldTime, recordedAt ->
            followAll(effects, state, command.houseId, player, worldTime, recordedAt)
        }
        return when (command) {
            is FoundHouse -> when (state) {
                is House.Founded -> throw HouseError.AlreadyFounded
                is House.NotFounded -> listOf(founding(command))
            }
            is ChoiceCommand -> Choices.decide(command, state, follow)
            is ResourceCommand -> founded(state).treasury.decide(command)
            is KeyFigureCommand -> founded(state).figures.decide(command)
            is VisionCommand -> founded(state).vision.decide(command)
            is SeatCommand -> founded(state).seating.decide(command)
            is DialogueCommand -> founded(state).let { house -> house.dialogues.decide(command, house.player, follow) }
        }
    }

    /** A house that exists, or the refusal. Everything but a founding and a choice needs one. */
    internal fun founded(state: House): House.Founded =
        state as? House.Founded ?: throw HouseError.NoSuchHouse

    private fun founding(command: FoundHouse): HouseFounded = HouseFounded(
        houseId = command.houseId,
        player = command.player,
        name = command.name,
        seat = command.seat,
        significance = FOUNDING_SIGNIFICANCE,
        banner = command.banner,
        resources = foundingStocks(command.recordedAt),
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
            treasury = Treasury(everyStock(event.resources, event.recordedAt)),
            foundedOn = event.worldTime,
            foundedAt = event.recordedAt,
            // Founding by any means settles a choice that was about founding: a house founded from the
            // debug button or by a seed has no use for a parchment asking where to put itself. A choice
            // about anything else is still open, and survives. See decision record 0034.
            pending = state.pending?.takeUnless { choice ->
                choice.options.any { it.effect is Effect.FoundAt }
            },
        )

        is ChoiceEvent -> Choices.evolve(state, event)

        // A part's event on a house that does not exist cannot be reached: the decider refuses every command
        // that would write one. Evolve is total anyway, because a fold must never throw.
        is ResourceEvent -> state.ifFounded { copy(treasury = treasury.evolve(event)) }
        is KeyFigureEvent -> state.ifFounded { copy(figures = figures.evolve(event)) }
        is VisionEvent -> state.ifFounded { copy(vision = vision.evolve(event)) }
        is SeatEvent -> state.ifFounded { copy(seating = seating.evolve(event)) }
        is DialogueEvent -> state.ifFounded { copy(dialogues = dialogues.evolve(event)) }
    }

    private inline fun House.ifFounded(change: House.Founded.() -> House): House = when (this) {
        is House.NotFounded -> this
        is House.Founded -> change()
    }
}
