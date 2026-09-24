package villages.projections

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.comparables.shouldBeGreaterThan
import io.kotest.matchers.shouldBe
import villages.application.EventFeed
import villages.application.KeyFiguresChange
import villages.application.Start
import villages.application.StoredEvent
import villages.domain.Banner
import villages.domain.CharacterAged
import villages.domain.CharacterAppeared
import villages.domain.CharacterDied
import villages.domain.CharacterId
import villages.domain.CharacterName
import villages.domain.CharacterStatChanged
import villages.domain.Charge
import villages.domain.Division
import villages.domain.Event
import villages.domain.HouseFounded
import villages.domain.HouseGainedKeyFigure
import villages.domain.HouseId
import villages.domain.HouseLostKeyFigure
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.Sex
import villages.domain.Significance
import villages.domain.Species
import villages.domain.Stat
import villages.domain.Tincture
import villages.domain.WorldTime
import villages.domain.emptyStocks
import java.time.Instant
import java.util.UUID

/** A feed that delivers whatever it is handed, of either kind of stream, the moment it is handed it. */
private class HandFedEvents : EventFeed {
    private val subscribers = mutableListOf<(StoredEvent) -> Unit>()

    override fun subscribe(from: Start, subscriber: (StoredEvent) -> Unit): AutoCloseable {
        subscribers += subscriber
        return AutoCloseable { subscribers -= subscriber }
    }

    fun deliver(event: Event) {
        val stored = StoredEvent(
            id = UUID.randomUUID().toString(),
            type = event::class.simpleName!!,
            stream = "whatever",
            streamVersion = 1,
            time = event.recordedAt,
            data = "{}",
            correlationId = UUID.randomUUID().toString(),
            causationId = UUID.randomUUID().toString(),
            event = event,
        )
        subscribers.toList().forEach { it(stored) }
    }
}

class CharactersProjectionSpec : StringSpec({
    val noon = Instant.parse("2026-09-04T12:00:00Z")
    val today = WorldTime(653_705)
    val ada = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    val bea = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8e"))
    val adas = HouseId.of(ada)
    val beas = HouseId.of(bea)
    val sable = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT)

    fun figure(n: Int) = CharacterId(UUID.fromString("cc000000-0000-4000-8000-%012d".format(n)))
    fun founded(player: PlayerId, name: String) = HouseFounded(
        HouseId.of(player), player, HouseName(name), Location(59.33, 18.07), Significance(20.0), sable,
        emptyStocks(noon), today, noon,
    )
    fun appeared(n: Int) = CharacterAppeared(
        characterId = figure(n),
        name = CharacterName("Agnes", "Hollin"),
        sex = Sex.WOMAN,
        species = Species.PERSON,
        bornOn = WorldTime(642_700),
        stats = mapOf(Stat.PIETY to 13, Stat.REASON to 9, Stat.KINDNESS to 11, Stat.PHYSICAL to 7),
        portrait = "woman-03",
        worldTime = today,
        recordedAt = noon,
    )

    fun rig(): Triple<HandFedEvents, CharactersProjection, MutableList<KeyFiguresChange>> {
        val feed = HandFedEvents()
        val projection = CharactersProjection(feed)
        val told = mutableListOf<KeyFiguresChange>()
        projection.watch { told += it }
        feed.deliver(founded(ada, "Ravenscar"))
        feed.deliver(founded(bea, "Hollin"))
        return Triple(feed, projection, told)
    }

    "a key figure taken in is on the house's list, in the order taken, saying who holds them" {
        val (feed, projection, told) = rig()
        for (n in 1..3) {
            feed.deliver(appeared(n))
            feed.deliver(HouseGainedKeyFigure(adas, figure(n), today, noon))
        }

        projection.of(adas).map { it.id } shouldBe listOf(figure(1), figure(2), figure(3))
        projection.of(adas).first().keyFigureOf.single().name shouldBe HouseName("Ravenscar")
        told.last().player shouldBe ada
        told.last().keyFigures shouldHaveSize 3
        projection.of(beas).shouldBeEmpty()
    }

    "a tie that arrives before its character is kept, and filled in when they appear" {
        val (feed, projection, _) = rig()
        feed.deliver(HouseGainedKeyFigure(adas, figure(1), today, noon))
        projection.of(adas).shouldBeEmpty()

        feed.deliver(appeared(1))

        projection.of(adas).single().keyFigureOf.single().house shouldBe adas
    }

    "a change to a character's own record tells every house that holds them, once each" {
        val (feed, _, told) = rig()
        feed.deliver(appeared(1))
        feed.deliver(HouseGainedKeyFigure(adas, figure(1), today, noon))
        feed.deliver(HouseGainedKeyFigure(beas, figure(1), today, noon))
        told.clear()

        feed.deliver(CharacterStatChanged(figure(1), Stat.PIETY, 15, today, noon))

        told.map { it.player }.toSet() shouldBe setOf(ada, bea)
        told shouldHaveSize 2
        told.forEach { it.keyFigures.single().stats[Stat.PIETY] shouldBe 15 }
        // Held by two houses, listed in the order they took her in: the first is whose colours she wears.
        told.first().keyFigures.single().keyFigureOf.map { it.house } shouldBe listOf(adas, beas)
    }

    "an age changed out of the ordinary adds up" {
        val (feed, projection, _) = rig()
        feed.deliver(appeared(1))
        feed.deliver(HouseGainedKeyFigure(adas, figure(1), today, noon))

        feed.deliver(CharacterAged(figure(1), 10, today, noon))
        feed.deliver(CharacterAged(figure(1), -3, today, noon))

        projection.of(adas).single().agedYears shouldBe 7
    }

    "a dead key figure leaves the list the moment they die, before any house has lost them" {
        val (feed, projection, told) = rig()
        feed.deliver(appeared(1))
        feed.deliver(HouseGainedKeyFigure(adas, figure(1), today, noon))
        told.clear()

        feed.deliver(CharacterDied(figure(1), "a fever", today, noon))

        projection.of(adas).shouldBeEmpty()
        told.single().keyFigures.shouldBeEmpty()
    }

    "a key figure lost leaves the house's list and the house is told" {
        val (feed, projection, told) = rig()
        feed.deliver(appeared(1))
        feed.deliver(HouseGainedKeyFigure(adas, figure(1), today, noon))
        told.clear()

        feed.deliver(HouseLostKeyFigure(adas, figure(1), today, noon))

        projection.of(adas).shouldBeEmpty()
        told.single().house shouldBe adas
    }

    "the revision rises with every change, whichever stream the change came from" {
        val (feed, projection, _) = rig()
        feed.deliver(appeared(1))
        feed.deliver(HouseGainedKeyFigure(adas, figure(1), today, noon))
        val tied = projection.of(adas).single().revision

        feed.deliver(CharacterStatChanged(figure(1), Stat.REASON, 10, today, noon))

        projection.of(adas).single().revision shouldBeGreaterThan tied
    }

    "a wipe forgets everyone, and the revision goes on climbing past what came before" {
        val (feed, projection, _) = rig()
        feed.deliver(appeared(1))
        feed.deliver(HouseGainedKeyFigure(adas, figure(1), today, noon))
        val before = projection.of(adas).single().revision

        projection.reset()
        projection.size shouldBe 0
        feed.deliver(founded(ada, "Ravenscar"))
        feed.deliver(appeared(1))
        feed.deliver(HouseGainedKeyFigure(adas, figure(1), today, noon))

        projection.of(adas).single().revision shouldBeGreaterThan before
    }
})
