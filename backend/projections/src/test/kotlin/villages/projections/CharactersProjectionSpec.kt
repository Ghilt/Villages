package villages.projections

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.comparables.shouldBeGreaterThan
import io.kotest.matchers.shouldBe
import villages.application.CharacterMapChange
import villages.application.CharacterSpan
import villages.application.EventFeed
import villages.application.KeyFiguresChange
import villages.application.Start
import villages.application.StoredEvent
import villages.domain.Banner
import villages.domain.CharacterAged
import villages.domain.CharacterAppeared
import villages.domain.CharacterDied
import villages.domain.CharacterId
import villages.domain.CharacterLeftTheMap
import villages.domain.CharacterMoved
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
import villages.protocol.Cell
import java.time.Instant
import java.util.UUID
import villages.domain.UNRECORDED_STAT

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

    val helsinki = Location(60.17, 24.94)
    val stockholm = Location(59.33, 18.07)
    val ten = Significance(10.0)
    val later = WorldTime(today.day + 31)
    fun cellOf(place: Location, zoom: Int) = Cell.of(place.lat, place.lon, zoom).quadkey

    // Ten is the significance every key figure has on the map, and it is drawn from zoom 9 in.
    "a character moved onto the map is in the cell their place falls in, from the zoom their significance says" {
        val (feed, projection, _) = rig()
        feed.deliver(appeared(1))
        feed.deliver(CharacterMoved(figure(1), helsinki, ten, today, noon))

        projection.inCell(cellOf(helsinki, 9), today, 10).characters.single().row.id shouldBe figure(1)
        projection.inCell(cellOf(helsinki, 9), today, 10).characters.single().span.place shouldBe helsinki
        projection.inCell(cellOf(helsinki, 8), today, 10).characters.shouldBeEmpty()
        projection.inCell(cellOf(helsinki, 8), today, 10, everything = true).characters shouldHaveSize 1
        projection.inCell(cellOf(stockholm, 9), today, 10).characters.shouldBeEmpty()
    }

    "a character nobody has moved is on no map at all" {
        val (feed, projection, _) = rig()
        feed.deliver(appeared(1))

        projection.inCell(cellOf(helsinki, 9), today, 10, everything = true).characters.shouldBeEmpty()
    }

    // The defect a span exists to stop: a character who moves staying drawn in the cell they left.
    "a move closes the span they stood in, so the cell they left held them only until the day they moved" {
        val (feed, projection, _) = rig()
        feed.deliver(appeared(1))
        feed.deliver(CharacterMoved(figure(1), helsinki, ten, today, noon))
        feed.deliver(CharacterMoved(figure(1), stockholm, ten, later, noon))

        projection.inCell(cellOf(helsinki, 9), today, 10).characters shouldHaveSize 1
        projection.inCell(cellOf(helsinki, 9), later, 10).characters.shouldBeEmpty()
        projection.inCell(cellOf(stockholm, 9), later, 10).characters shouldHaveSize 1
        projection.inCell(cellOf(stockholm, 9), today, 10).characters.shouldBeEmpty()
    }

    "leaving the map and dying both close the span, and the days before still hold them" {
        val (feed, projection, _) = rig()
        feed.deliver(appeared(1))
        feed.deliver(appeared(2))
        feed.deliver(CharacterMoved(figure(1), helsinki, ten, today, noon))
        feed.deliver(CharacterMoved(figure(2), helsinki, ten, today, noon))

        feed.deliver(CharacterLeftTheMap(figure(1), later, noon))
        feed.deliver(CharacterDied(figure(2), "a fever", later, noon))

        projection.inCell(cellOf(helsinki, 9), later, 10).characters.shouldBeEmpty()
        projection.inCell(cellOf(helsinki, 9), today, 10).characters shouldHaveSize 2
    }

    "the map is told where they stood and where they stand now, and a stat change tells it nothing" {
        val (feed, projection, _) = rig()
        val moves = mutableListOf<CharacterMapChange>()
        projection.watchTheMap { moves += it }
        feed.deliver(appeared(1))

        feed.deliver(CharacterMoved(figure(1), helsinki, ten, today, noon))
        feed.deliver(CharacterMoved(figure(1), stockholm, ten, later, noon))
        feed.deliver(CharacterStatChanged(figure(1), Stat.PIETY, 15, later, noon))
        feed.deliver(CharacterLeftTheMap(figure(1), later, noon))

        moves shouldHaveSize 3
        moves[0].was shouldBe null
        moves[0].now?.place shouldBe helsinki
        moves[1].was shouldBe CharacterSpan(helsinki, ten, since = today, until = later)
        moves[1].now?.place shouldBe stockholm
        moves[2].was?.place shouldBe stockholm
        moves[2].now shouldBe null
    }

    "an appearance written before a stat existed is read with the middle of the scale of it" {
        val (feed, projection, _) = rig()
        val agnes = appeared(1)
        feed.deliver(agnes.copy(stats = agnes.stats - Stat.KINDNESS))
        feed.deliver(HouseGainedKeyFigure(adas, figure(1), today, noon))

        projection.of(adas).single().stats[Stat.KINDNESS] shouldBe UNRECORDED_STAT
    }
})
