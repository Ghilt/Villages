package villages.application.fate

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.types.shouldBeInstanceOf
import villages.application.HouseRow
import villages.domain.Banner
import villages.domain.Charge
import villages.domain.Division
import villages.domain.Effect
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.Significance
import villages.domain.Tincture
import villages.domain.WorldTime
import villages.domain.foundingStocks
import java.time.Instant
import java.util.UUID

/** Gossip about the nearest other house: named, about that house, and not dealt with nobody near. */
class GossipSpec : StringSpec({
    val today = WorldTime(454901)
    fun houseAt(name: String, at: Location) = HouseRow(
        HouseId.of(PlayerId(UUID.randomUUID())), PlayerId(UUID.randomUUID()), HouseName(name), at, Significance(20.0),
        Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT),
        resources = foundingStocks(Instant.EPOCH), pledges = emptyList(), since = today, until = null, version = 1,
    )
    val ours = houseAt("Ravenscar", Location(59.33, 18.07))
    val varga = houseAt("Varga", Location(59.9, 10.7))
    val holm = houseAt("Holm", Location(60.17, 24.94))
    val far = houseAt("Faraway", Location(-33.9, 151.2))
    fun dealing(vararg standing: HouseRow) =
        Gossip({ place, km, _ -> standing.filter { kmBetween(it.seat, place) <= km } }) { UUID.randomUUID() }
            .action.deal(Moment(ours, Looking.NOTHING, today, Instant.EPOCH), emptyList())

    "a servant brings word of the nearest other house, by its name, as a conversation" {
        val dealt = dealing(ours, varga, holm, far)!!

        dealt.label shouldBe "Gossip from the kitchens"
        dealt.detail shouldContain "House Holm"
        val talk = dealt.effect.shouldBeInstanceOf<Effect.Converse>().dialogue
        talk.title shouldBe "Word of House Holm"
        talk.lines.first().words shouldContain "House Holm"
    }

    "the same house always has the same rumour" {
        val once = dealing(ours, holm)!!.effect.shouldBeInstanceOf<Effect.Converse>().dialogue.lines.first().words
        val twice = dealing(ours, holm)!!.effect.shouldBeInstanceOf<Effect.Converse>().dialogue.lines.first().words

        once shouldBe twice
    }

    "with no other house near enough to have heard of, there is nothing to say" {
        dealing(ours, far).shouldBeNull()
        dealing(ours).shouldBeNull()
    }

    "spreading it pays a little influence, and keeping it costs nothing" {
        val talk = dealing(ours, holm)!!.effect.shouldBeInstanceOf<Effect.Converse>().dialogue

        talk.lines.single { it.id.value == "spread" }.effects shouldBe listOf(Effect.Grant(villages.domain.Resource.INFLUENCE, Gossip.SPREAD))
        talk.lines.single { it.id.value == "keep" }.effects shouldBe emptyList()
    }
})
