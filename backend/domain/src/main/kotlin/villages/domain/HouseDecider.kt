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
            command.choice.refuseUnlessGivableTo(state)
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
            ) + followAll(
                listOf(taken.effect), state, command.houseId, command.player, command.worldTime, command.recordedAt,
            )
        }

        // Several can be open at once, and the dialogue has checked itself already, so what is left to the house
        // is that it exists and has not been offered this one before. See decision record 0071.
        is OfferDialogue -> {
            val house = founded(state)
            if (command.dialogue.id in house.offeredDialogues) {
                throw HouseError.DialogueAlreadyOffered
            }
            listOf(
                PlayerOfferedDialogue(
                    houseId = command.houseId,
                    player = house.player,
                    dialogue = command.dialogue,
                    worldTime = command.worldTime,
                    recordedAt = command.recordedAt,
                ),
            )
        }

        // The step, what the line does and the end come out of one decision, as an action and its effect do,
        // so they are appended together and never seen apart. The walk says where a step may be taken, and
        // nothing else is, which is what pays each line once on every path. See decision record 0071.
        is CompleteDialogueStep -> {
            val house = founded(state)
            val open = house.openDialogues.firstOrNull { it.dialogue.id == command.dialogueId }
                ?: throw when (command.dialogueId) {
                    in house.offeredDialogues -> HouseError.DialogueOver
                    else -> HouseError.NoSuchDialogue
                }
            if (!open.walk().allows(command.lineId)) {
                throw HouseError.NotTheNextStep
            }
            val line = checkNotNull(open.dialogue.line(command.lineId)) { "the walk allowed a line the dialogue lacks" }
            val consequences =
                followAll(line.effects, state, command.houseId, house.player, command.worldTime, command.recordedAt)
            val ends = when (line.then) {
                Then.End -> listOf(
                    PlayerCompletedDialogue(command.houseId, house.player, open.dialogue.id, command.worldTime, command.recordedAt),
                )
                else -> emptyList()
            }
            listOf(
                PlayerCompletedDialogueStep(
                    houseId = command.houseId,
                    player = house.player,
                    dialogueId = open.dialogue.id,
                    lineId = command.lineId,
                    worldTime = command.worldTime,
                    recordedAt = command.recordedAt,
                ),
            ) + consequences + ends
        }

        // What a failed requirement ends is the house's own rule: every open dialogue that needed it lapses,
        // all in one decision, and a failure that touches none writes nothing. See decision record 0071.
        is FailRequirement -> {
            val house = founded(state)
            house.openDialogues.filter { command.requirement in it.dialogue.needs() }.map { open ->
                PlayerLostDialogue(
                    houseId = command.houseId,
                    player = house.player,
                    dialogueId = open.dialogue.id,
                    because = command.requirement,
                    worldTime = command.worldTime,
                    recordedAt = command.recordedAt,
                )
            }
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

        // How far a house sees is the world's to say rather than the command's, so the size goes on the event
        // from here, and a later change to it leaves what was given as it was. See decision record 0061.
        is GiveVision -> {
            if (command.visionId in founded(state).visions) {
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
            if (command.visionId !in founded(state).visions) {
                throw HouseError.NoSuchVision
            }
            listOf(HouseLostVision(command.houseId, command.visionId, command.worldTime, command.recordedAt))
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
    internal fun founded(state: House): House.Founded =
        state as? House.Founded ?: throw HouseError.NoSuchHouse

    private fun anAmount(amount: Long) {
        if (amount <= 0) {
            throw HouseError.InvalidAmount("an amount is more than nothing, and $amount is not")
        }
    }

    internal fun enough(house: House.Founded, resource: Resource, wanted: Long, now: Instant) {
        if (!house.has(resource, wanted, now)) {
            throw HouseError.NotEnoughFree(resource, wanted, house.freeOf(resource, now))
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

        is PlayerOfferedDialogue -> when (state) {
            is House.NotFounded -> state
            is House.Founded -> state.copy(
                openDialogues = state.openDialogues + OpenDialogue(event.dialogue),
                offeredDialogues = state.offeredDialogues + event.dialogue.id,
            )
        }

        is PlayerCompletedDialogueStep -> when (state) {
            is House.NotFounded -> state
            is House.Founded -> state.copy(
                openDialogues = state.openDialogues.map { open ->
                    if (open.dialogue.id == event.dialogueId) open.copy(taken = open.taken + event.lineId) else open
                },
            )
        }

        // A dialogue that has ended, finished or lost, is no longer open, and its id stays among those offered,
        // so a step on it is refused as over rather than as unknown.
        is PlayerCompletedDialogue -> when (state) {
            is House.NotFounded -> state
            is House.Founded -> state.copy(
                openDialogues = state.openDialogues.filterNot { it.dialogue.id == event.dialogueId },
            )
        }

        is PlayerLostDialogue -> when (state) {
            is House.NotFounded -> state
            is House.Founded -> state.copy(
                openDialogues = state.openDialogues.filterNot { it.dialogue.id == event.dialogueId },
            )
        }

        is HouseGainedKeyFigure -> when (state) {
            is House.NotFounded -> state
            is House.Founded -> state.copy(keyFigures = state.keyFigures + event.characterId)
        }

        is HouseLostKeyFigure -> when (state) {
            is House.NotFounded -> state
            is House.Founded -> state.copy(keyFigures = state.keyFigures - event.characterId)
        }

        is HouseGainedVision -> when (state) {
            is House.NotFounded -> state
            is House.Founded -> state.copy(visions = state.visions + event.visionId)
        }

        is HouseLostVision -> when (state) {
            is House.NotFounded -> state
            is House.Founded -> state.copy(visions = state.visions - event.visionId)
        }
    }
}
