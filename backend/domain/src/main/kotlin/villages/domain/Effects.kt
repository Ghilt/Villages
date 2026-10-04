package villages.domain

import java.time.Instant

/**
 * What a list of effects records, beyond the action or the step that set them off, for this house and its player
 * at the command's two times. Choices and dialogues share it, so a new effect is one branch of `follows` for both.
 *
 * Each effect is decided against the house the ones before it left, not the house before the decision: a cost
 * after a cost is paid out of what the first left free, and a grant before a cost can pay for it. Two costs a
 * house could each afford but not both are refused together, so a decision never writes what its own fold could
 * not apply. See decision record 0071.
 */
/**
 * How a part of a house asks the rest of it for what a list of effects records, for a player at two times. The
 * decider hands one to the part that decides a command, so that the part never touches another: an effect is the
 * only way from one part of a house to another. See decision record 0075.
 */
internal fun interface Follow {
    fun follow(effects: List<Effect>, player: PlayerId, worldTime: WorldTime, recordedAt: Instant): List<HouseEvent>
}

@Suppress("LongParameterList")
internal fun followAll(
    effects: List<Effect>,
    state: House,
    houseId: HouseId,
    player: PlayerId,
    worldTime: WorldTime,
    recordedAt: Instant,
): List<HouseEvent> {
    var left = state
    return effects.flatMap { effect ->
        follows(effect, left, houseId, player, worldTime, recordedAt).also { events ->
            left = events.fold(left, HouseDecider::evolve)
        }
    }
}

@Suppress("LongParameterList")
private fun follows(
    effect: Effect,
    state: House,
    houseId: HouseId,
    player: PlayerId,
    worldTime: WorldTime,
    recordedAt: Instant,
): List<HouseEvent> = when (effect) {
    is Effect.FoundAt -> when (state) {
        is House.Founded -> throw HouseError.AlreadyFounded
        is House.NotFounded -> listOf(
            HouseFounded(
                houseId = houseId,
                player = player,
                name = effect.name,
                seat = effect.seat,
                significance = HouseDecider.FOUNDING_SIGNIFICANCE,
                banner = effect.banner,
                resources = foundingStocks(recordedAt),
                worldTime = worldTime,
                recordedAt = recordedAt,
            ),
        )
    }

    // Nothing gives to a house that does not exist - a choice that grants is never given to one, and a
    // dialogue is only offered to a founded house - so this refusal is not reached. It is here because what
    // a state can be given is the decider's rule, not the giver's.
    is Effect.Grant -> {
        HouseDecider.founded(state)
        listOf(HouseResourceGranted(houseId, effect.resource, effect.amount, worldTime, recordedAt))
    }

    // What an option costs is refused when the house has not that much free, as spending is, and then the
    // action or the step is refused with it: the player answers otherwise. See decision record 0071.
    is Effect.Spend -> {
        HouseDecider.founded(state).treasury.enough(effect.resource, effect.amount, recordedAt)
        listOf(HouseResourceSpent(houseId, effect.resource, effect.amount, worldTime, recordedAt))
    }
}

/**
 * Whether taking an option or reaching a line with these effects costs the house anything: what a house that
 * cannot pay has to be able to answer otherwise than, in a choice as in a dialogue.
 */
internal fun costsSomething(effects: List<Effect>): Boolean = effects.any { it is Effect.Spend }
