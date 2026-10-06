package villages.application.fate

import villages.application.FreshIds
import villages.application.HouseRow
import villages.domain.Dialogue
import villages.domain.DialogueId
import villages.domain.Effect
import villages.domain.Impact
import villages.domain.Line
import villages.domain.LineId
import villages.domain.Rarity
import villages.domain.Resource
import villages.domain.RevealImpact
import villages.domain.Speaker
import villages.domain.SpeakerId
import villages.domain.Then

/**
 * **Gossip**, the first action that is a conversation: a servant brings word of the nearest other house, by its
 * name, and the house can spread it or keep it. A common, in Hearth and in Court. With no other house near enough
 * to have heard of, it cannot be dealt, and the hand is drawn without it. What is said is one of a few rumours,
 * chosen by the house it is about so the same house always has the same reputation; a gossip engine is later work.
 * See `docs/plans/choice-roll.md`.
 */
class Gossip(private val houses: HousesNear, private val ids: FreshIds) {
    val action = Action("gossip.common", Rarity.COMMON, setOf(Pool.HEARTH, FirstPools.COURT)) { moment, _ ->
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
                    Line(LineId("spread"), HOUSE, "Let it be repeated at market.", listOf(Effect.Grant(Resource.INFLUENCE, SPREAD)),
                        then = Then.End, revealImpact = RevealImpact.Shown(listOf(Impact(Resource.INFLUENCE, SPREAD)))),
                    Line(LineId("keep"), HOUSE, "Keep it to yourself.", then = Then.End),
                ),
            ).let { Dealt("Gossip from the kitchens", "A servant has heard something about $name.", Effect.Converse(it)) }
        }
    }

    private fun nearestTo(moment: Moment): HouseRow? =
        houses.near(moment.house.seat, HEARD_OF_KM, moment.today)
            .filter { it.id != moment.house.id }
            .minByOrNull { kmBetween(it.seat, moment.house.seat) }

    private fun rumourAbout(house: HouseRow): String = RUMOURS[Math.floorMod(house.id.value.hashCode(), RUMOURS.size)]

    companion object {
        private val SERVANT = SpeakerId("servant")
        private val HOUSE = SpeakerId("house")

        /** How much influence spreading it gives. */
        const val SPREAD = 5L

        /** How far a servant's gossip reaches: a house further off is not one the kitchens talk about. */
        const val HEARD_OF_KM = 1500.0

        val RUMOURS = listOf(
            "has been selling off its silver",
            "keeps a horse it cannot afford",
            "has quarrelled with its priest",
            "is to marry its heir to a merchant's daughter",
            "has not paid its masons since Michaelmas",
        )
    }
}

/**
 * Every action there is to deal from, which needs the world for those that name a part of it. One list, so the app
 * and every test that rolls deal from the same content. A new action is a line here.
 */
fun firstActions(houses: HousesNear, ids: FreshIds): List<Action> = ResourceActions.ALL + Gossip(houses, ids).action
