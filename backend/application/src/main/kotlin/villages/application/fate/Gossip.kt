package villages.application.fate

import villages.application.FreshIds
import villages.application.HouseRow
import villages.domain.Dialogue
import villages.domain.DialogueId
import villages.domain.Effect
import villages.domain.Impact
import villages.domain.Line
import villages.domain.LineId
import villages.domain.Resource
import villages.domain.RevealImpact
import villages.domain.Speaker
import villages.domain.SpeakerId
import villages.domain.Then

/**
 * **Gossip**, the first action that is a conversation: a servant brings word of the nearest other house, by its
 * name, and the house can spread it or keep it. With no other house near enough to have heard of, it cannot be dealt,
 * and the hand is drawn without it. What is said is one of a few rumours, chosen by the house it is about so the same
 * house always has the same reputation; a gossip engine is later work. Code, because it reads the world; its pools,
 * rarity, words, numbers and rumours are the fate catalogue's, `{house}` in its words the house it is about. See
 * `docs/plans/choice-roll.md` and decision record 0097.
 */
class Gossip(
    private val houses: HousesNear,
    private val ids: FreshIds,
    private val spec: FateCatalogue.ActionSpec,
    private val gossip: FateCatalogue.Deals.Gossip,
) {
    fun action(pools: Set<Pool>) = Action(spec.id, spec.rarity, pools) { moment, _ ->
        nearestTo(moment)?.let { other ->
            val name = "House ${other.name.value}"
            Dialogue(
                id = DialogueId.offered(moment.house.id, ids.fresh()),
                title = "Word of $name",
                scene = null,
                speakers = listOf(
                    Speaker(SERVANT, party = 1, name = "A servant", portrait = null, character = null),
                    Speaker(HOUSE, party = 0, name = "House ${moment.house.name.value}", portrait = null, character = null),
                ),
                lines = listOf(
                    Line(LineId("news"), SERVANT, "They are saying in the kitchens that $name ${rumourAbout(other)}.",
                        then = Then.DialogueChoice(listOf(LineId("spread"), LineId("keep")))),
                    Line(LineId("spread"), HOUSE, "Let it be repeated at market.", listOf(Effect.Grant(Resource.INFLUENCE, gossip.spreads)),
                        then = Then.End, revealImpact = RevealImpact.Shown(listOf(Impact(Resource.INFLUENCE, gossip.spreads)))),
                    Line(LineId("keep"), HOUSE, "Keep it to yourself.", then = Then.End),
                ),
            ).let { Dealt(spec.label.replace(ABOUT, name), spec.detail.replace(ABOUT, name), Effect.Converse(it)) }
        }
    }

    private fun nearestTo(moment: Moment): HouseRow? =
        houses.near(moment.house.seat, gossip.heardOfKm, moment.today)
            .filter { it.id != moment.house.id }
            .minByOrNull { kmBetween(it.seat, moment.house.seat) }

    private fun rumourAbout(house: HouseRow): String =
        gossip.rumours[Math.floorMod(house.id.value.hashCode(), gossip.rumours.size)]

    private companion object {
        val SERVANT = SpeakerId("servant")
        val HOUSE = SpeakerId("house")

        /** Where the house a rumour is about is named, in the action's words. */
        const val ABOUT = "{house}"
    }
}
