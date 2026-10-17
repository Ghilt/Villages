package villages.projections

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.property.Arb
import io.kotest.property.arbitrary.int
import io.kotest.property.arbitrary.long
import io.kotest.property.checkAll
import villages.application.EventFeed
import villages.application.Start
import villages.application.StoredEvent
import villages.application.started
import villages.domain.CharacterAppeared
import villages.domain.CharacterId
import villages.domain.CharacterLeftTheMap
import villages.domain.CharacterMoved
import villages.domain.CharacterName
import villages.domain.Event
import villages.domain.Location
import villages.domain.Sex
import villages.domain.Significance
import villages.domain.Species
import villages.domain.Stat
import villages.domain.WorldTime
import villages.protocol.Cell
import java.time.Instant
import java.util.UUID
import kotlin.random.Random

/** A feed that delivers what it is handed at once. */
private class Handing : EventFeed {
    private val subscribers = mutableListOf<(StoredEvent) -> Unit>()

    override fun subscribe(from: Start, subscriber: (StoredEvent) -> Unit): AutoCloseable {
        subscribers += subscriber
        return AutoCloseable { subscribers -= subscriber }
    }

    fun deliver(event: Event) {
        val stored = StoredEvent(
            id = UUID.randomUUID().toString(), type = event::class.simpleName!!, stream = "whatever", streamVersion = 1,
            time = event.recordedAt, data = "{}", correlationId = UUID.randomUUID().toString(),
            causationId = UUID.randomUUID().toString(), event = event,
        )
        subscribers.toList().forEach { it(stored) }
    }
}

/**
 * The characters' index against a plain scan: for generated worlds of people moving from cell to cell over the days and
 * leaving the map, every cell at every zoom, asked about any day, holds exactly those standing in it that day, as
 * asking each of them where they stood would say. See docs/plans/indexed-read-models.md.
 */
class CharactersIndexSpec : StringSpec({
    val noon = Instant.parse("2026-10-17T12:00:00Z")
    val first = 653_700L

    fun appeared(id: CharacterId) = CharacterAppeared(
        characterId = id, name = CharacterName("Agnes", "Hollin"), sex = Sex.WOMAN, species = Species.PERSON,
        bornOn = WorldTime(642_700), stats = mapOf(Stat.PIETY to 13, Stat.REASON to 9, Stat.KINDNESS to 11, Stat.PHYSICAL to 7),
        portrait = "woman-03", worldTime = WorldTime(first), recordedAt = noon,
    )

    "every cell on every day holds exactly those who stood in it that day" {
        checkAll(60, Arb.int(1, 30), Arb.long()) { people, seed ->
            val random = Random(seed)
            val feed = Handing()
            val characters = CharactersProjection(feed).started()
            val ids = List(people) { CharacterId(UUID(random.nextLong(), random.nextLong())) }
            ids.forEach { feed.deliver(appeared(it)) }
            // Each walks a few steps through a few clustered places, a day or more apart, and some leave the map.
            for (id in ids) {
                var day = first
                repeat(random.nextInt(1, 6)) {
                    day += random.nextLong(0, 4)
                    val place = Location(50 + random.nextDouble(-2.0, 2.0), 10 + random.nextDouble(-2.0, 2.0))
                    feed.deliver(CharacterMoved(id, place, Significance(10.0), WorldTime(day), noon))
                }
                if (random.nextBoolean()) feed.deliver(CharacterLeftTheMap(id, WorldTime(day + random.nextLong(0, 3)), noon))
            }

            for (day in first..first + 25) {
                val on = WorldTime(day)
                val standing = ids.mapNotNull { characters.standing(it, on) }
                val cells = standing.map { Cell.of(it.span.place.lat, it.span.place.lon).quadkey }
                    .flatMap { listOf(it, it.take(random.nextInt(0, it.length + 1))) } + listOf("", "1", "12")
                for (cell in cells) {
                    val scanned = standing.filter { Cell.of(it.span.place.lat, it.span.place.lon).quadkey.startsWith(cell) }
                    val indexed = characters.inCell(cell, on, most = Int.MAX_VALUE, everything = true)
                    indexed.characters.map { it.row.id to it.span }.toSet() shouldBe scanned.map { it.row.id to it.span }.toSet()
                }
            }
        }
    }
})
