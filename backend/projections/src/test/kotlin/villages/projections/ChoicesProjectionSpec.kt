package villages.projections

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import villages.application.ChoiceRow
import villages.application.EventFeed
import villages.application.Start
import villages.application.StoredEvent
import villages.application.started
import villages.domain.Banner
import villages.domain.Charge
import villages.domain.Choice
import villages.domain.ChoiceId
import villages.domain.Division
import villages.domain.Effect
import villages.domain.HouseEvent
import villages.domain.HouseFounded
import villages.domain.PlayerGivenChoice
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Omen
import villages.domain.OmenKey
import villages.domain.OmenKind
import villages.domain.PlayerRolled
import villages.domain.PlayerTookAction
import villages.domain.Rarity
import villages.domain.RollId
import villages.domain.Location
import villages.domain.Option
import villages.domain.OptionId
import villages.domain.PlayerId
import villages.domain.Significance
import villages.domain.Tincture
import villages.domain.emptyStocks
import villages.domain.WorldTime
import java.time.Instant
import java.util.UUID

/** A feed that delivers what it is handed, when it is handed it, and can hand over what came before. */
private class ChoicesFed : EventFeed {
    private val stored = mutableListOf<StoredEvent>()
    private val subscribers = mutableListOf<(StoredEvent) -> Unit>()

    override fun subscribe(from: Start, subscriber: (StoredEvent) -> Unit): AutoCloseable {
        if (from == Start.FROM_THE_BEGINNING) {
            stored.forEach(subscriber)
        }
        subscribers += subscriber
        return AutoCloseable { subscribers -= subscriber }
    }

    fun deliver(event: HouseEvent, story: String = "a-story", version: Long = 1) {
        val record = StoredEvent(
            id = UUID.randomUUID().toString(),
            type = "villages.house.x.v1",
            stream = event.houseId.stream,
            streamVersion = version,
            time = event.recordedAt,
            data = "{}",
            correlationId = story,
            causationId = UUID.randomUUID().toString(),
            event = event,
        )
        stored += record
        subscribers.toList().forEach { it(record) }
    }
}

private val atNoon = Instant.parse("2026-09-04T12:00:00Z")
private val onDay = WorldTime(454901)
private val adam = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
private val house = HouseId.of(adam)
private val sable = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT)

private val northern = OptionId(UUID.fromString("aa000000-0000-4000-8000-000000000001"))
private val southern = OptionId(UUID.fromString("aa000000-0000-4000-8000-000000000002"))
private val whereToSettle = Choice(
    id = ChoiceId(UUID.fromString("aa000000-0000-4000-8000-00000000c401")),
    prompt = "Where shall the house raise its seat?",
    options = listOf(
        Option(northern, "Skarnholt", "Cold.", Effect.FoundAt(Location(61.0, 15.0), HouseName("Ravenscar"), sable)),
        Option(southern, "Zafarai", "Hot.", Effect.FoundAt(Location(14.0, 4.0), HouseName("Hollin"), sable)),
    ),
)

private fun given(story: String = "a-story") =
    PlayerGivenChoice(house, adam, whereToSettle, onDay, atNoon) to story

private fun tookAction() = PlayerTookAction(house, adam, whereToSettle.id, northern, onDay, atNoon)

private fun aFounding() = HouseFounded(
    houseId = house,
    player = adam,
    name = HouseName("Ravenscar"),
    seat = Location(61.0, 15.0),
    significance = Significance(20.0),
    banner = sable,
    resources = emptyStocks(atNoon),
    worldTime = onDay,
    recordedAt = atNoon,
)

class ChoicesProjectionSpec : StringSpec({

    "a player who has been given a choice has one pending, with the story it began" {
        val feed = ChoicesFed()
        val choices = ChoicesProjection(feed).started()
        val (event, story) = given("the-founding-story")

        feed.deliver(event, story)

        choices.pendingOf(adam) shouldBe ChoiceRow(adam, house, whereToSettle, "the-founding-story")
        choices.size shouldBe 1
    }

    "a hand a roll dealt carries the omens the roll read, and a choice in another story does not" {
        val feed = ChoicesFed()
        val choices = ChoicesProjection(feed).started()
        val river = Omen(OmenKey("map.river"), OmenKind.MAP, "River")
        val roll = PlayerRolled(house, adam, RollId(UUID.randomUUID()), listOf(river), Rarity.COMMON, onDay, atNoon)

        feed.deliver(roll, "a-roll")
        feed.deliver(given().first, "a-roll", version = 3)

        choices.pendingOf(adam)?.omens shouldBe listOf(river)

        feed.deliver(tookAction(), version = 4)
        feed.deliver(roll, "another-roll", version = 5)
        feed.deliver(given().first, "not-that-roll", version = 7)

        choices.pendingOf(adam)?.omens shouldBe emptyList()
    }

    "a player who has been given nothing has nothing" {
        ChoicesProjection(ChoicesFed()).started().pendingOf(adam).shouldBeNull()
    }

    "answering it takes it away" {
        val feed = ChoicesFed()
        val choices = ChoicesProjection(feed).started()
        feed.deliver(given().first)

        feed.deliver(tookAction(), version = 2)

        choices.pendingOf(adam).shouldBeNull()
        choices.size shouldBe 0
    }

    "and so does founding by other means, because a house standing is not asked where to stand" {
        val feed = ChoicesFed()
        val choices = ChoicesProjection(feed).started()
        feed.deliver(given().first)

        feed.deliver(aFounding(), version = 2)

        choices.pendingOf(adam).shouldBeNull()
    }

    "a watcher hears what each player has to decide, and hears when they no longer do" {
        val feed = ChoicesFed()
        val choices = ChoicesProjection(feed).started()
        val heard = mutableListOf<Pair<PlayerId, ChoiceRow?>>()
        choices.watch { player, row -> heard += player to row }

        feed.deliver(given().first)
        feed.deliver(tookAction(), version = 2)

        heard.map { it.second?.choice?.prompt } shouldBe listOf(whereToSettle.prompt, null)
    }

    "an answer to nothing tells nobody anything, so a replay does not raise a parchment twice" {
        val feed = ChoicesFed()
        val choices = ChoicesProjection(feed).started()
        val heard = mutableListOf<Pair<PlayerId, ChoiceRow?>>()
        choices.watch { player, row -> heard += player to row }

        feed.deliver(aFounding())

        heard.shouldBeEmpty()
    }

    "a projection built after the fact folds the whole feed and knows what is still pending" {
        val feed = ChoicesFed()
        feed.deliver(given().first)

        ChoicesProjection(feed).started().pendingOf(adam)?.choice shouldBe whereToSettle
    }

    "a reset projection has forgotten everyone, because the world they were asked in is gone" {
        val feed = ChoicesFed()
        val choices = ChoicesProjection(feed).started()
        feed.deliver(given().first)

        choices.reset()

        choices.pendingOf(adam).shouldBeNull()
        choices.size shouldBe 0
    }

    "a watcher that stopped hears nothing more" {
        val feed = ChoicesFed()
        val choices = ChoicesProjection(feed).started()
        val heard = mutableListOf<Pair<PlayerId, ChoiceRow?>>()
        choices.watch { player, row -> heard += player to row }.close()

        feed.deliver(given().first)

        heard.shouldBeEmpty()
    }
})
