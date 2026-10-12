package villages.application

import villages.domain.Choice
import villages.domain.ChoiceId
import villages.domain.GiveChoice
import villages.domain.HouseError
import villages.domain.HouseId
import villages.domain.OptionId
import villages.domain.PlayerId
import villages.domain.TakeAction
import java.util.UUID

/**
 * What happens when a player arrives: a player with no house and nothing to decide is asked where to
 * found one.
 *
 * The giver of the first choice, in the sense docs/MECHANICS.md means. It asks nothing of a read model
 * before it acts: the decider refuses a second choice and refuses a founding choice to a founded house,
 * and those refusals are the answer. Reading a projection first would be an optimisation with a stale
 * read in it, because a projection is always a moment behind the stream.
 */
class Arrival(
    private val executor: HouseCommandExecutor,
    private val clock: Clock,
    private val world: WorldClock,
    private val ids: FreshIds,
) {
    /**
     * Gives this player the founding choice, and hands back what was given and the story giving it began. Null
     * when there was nothing to give: they have a house already, or a choice already, which are the two
     * ordinary cases.
     *
     * Returning the choice matters. The gateway has to tell the browser what is pending the moment it
     * says hello, and the projection that would otherwise answer that is folded on another thread; asking
     * it here would be a race that sometimes said "nothing" about a choice just written. And the story with it,
     * so that the action answering the choice continues it without asking the projection either, which is a
     * further hop behind when the broker carries the world (decision records 0035 and 0094).
     */
    fun arrive(player: PlayerId): Given? {
        val choice = FoundingChoices.forPlayer(player)
        val id = ids.fresh()

        return try {
            executor.execute(
                GiveChoice(
                    houseId = HouseId.of(player),
                    player = player,
                    choice = choice,
                    worldTime = world.today(),
                    recordedAt = clock.now(),
                ),
                // Arriving starts a story, and everything that follows from this choice belongs to it.
                Provenance.startedBy(id),
            )
            Given(choice, story = id)
        } catch (@Suppress("SwallowedException") nothingToGive: HouseError.ChoicePending) {
            null
        } catch (@Suppress("SwallowedException") nothingToGive: HouseError.AlreadyFounded) {
            null
        }
    }
}

/** A choice given on arriving, and the story giving it began, which the action answering it continues (0035). */
data class Given(val choice: Choice, val story: UUID)

/** Taking one option of the choice a house was given. What it does follows from the same decision. */
class TakeActionService(
    private val executor: HouseCommandExecutor,
    private val clock: Clock,
    private val world: WorldClock,
) {
    /** Throws a HouseError when the decider refuses, exactly as the decider threw it. */
    fun take(
        player: PlayerId,
        choiceId: ChoiceId,
        optionId: OptionId,
        provenance: Provenance,
    ) {
        executor.execute(
            TakeAction(
                houseId = HouseId.of(player),
                player = player,
                choiceId = choiceId,
                optionId = optionId,
                worldTime = world.today(),
                recordedAt = clock.now(),
            ),
            provenance,
        )
    }
}
