package villages.application

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import villages.domain.Banner
import villages.domain.CharacterAged
import villages.domain.CharacterAppeared
import villages.domain.CharacterCommand
import villages.domain.CharacterDecider
import villages.domain.CharacterDied
import villages.domain.CharacterEvent
import villages.domain.CharacterId
import villages.domain.CharacterPortraitChanged
import villages.domain.CharacterStatChanged
import villages.domain.Charge
import villages.domain.Division
import villages.domain.Event
import villages.domain.FoundHouse
import villages.domain.HouseCommand
import villages.domain.HouseDecider
import villages.domain.HouseError
import villages.domain.HouseEvent
import villages.domain.HouseGainedKeyFigure
import villages.domain.HouseId
import villages.domain.HouseLostKeyFigure
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.Stat
import villages.domain.Tincture
import villages.domain.WorldTime
import java.time.Instant
import java.util.UUID

/**
 * Both kinds of stream in two maps, each folded with its real decider, and every event written in the order
 * it was written: the order is what is under test, and a store would only be in the way.
 */
private class TwoKindsOfStream : HouseCommandExecutor, CharacterCommandExecutor {
    val houses = mutableMapOf<HouseId, MutableList<HouseEvent>>()
    val characters = mutableMapOf<CharacterId, MutableList<CharacterEvent>>()
    val written = mutableListOf<Pair<Event, Provenance>>()

    override fun execute(command: HouseCommand, provenance: Provenance) {
        val held = houses.getOrPut(command.houseId) { mutableListOf() }
        val decided = HouseDecider.decide(command, HouseDecider.fold(held))
        held += decided
        decided.forEach { written += it to provenance }
    }

    override fun execute(command: CharacterCommand, provenance: Provenance) {
        val held = characters.getOrPut(command.characterId) { mutableListOf() }
        val decided = CharacterDecider.decide(command, CharacterDecider.fold(held))
        held += decided
        decided.forEach { written += it to provenance }
    }
}

class KeyFigureServiceSpec : StringSpec({
    val noon = Instant.parse("2026-09-04T12:00:00Z")
    val today = WorldTime(653_705)
    val calendar = object : WorldCalendar {
        override fun plusMonths(day: WorldTime, months: Long) = WorldTime(day.day + months * 30)
        override fun monthsBetween(from: WorldTime, to: WorldTime) = (to.day - from.day) / 30
    }
    val portraits = Portraits { listOf("woman-01", "man-01") }
    val ada = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    val bea = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8e"))

    fun world(): Pair<TwoKindsOfStream, KeyFigureService> {
        val streams = TwoKindsOfStream()
        val service = KeyFigureService(streams, streams, { noon }, { today }, calendar, { 1 }, portraits)
        for (player in listOf(ada, bea)) {
            streams.execute(
                FoundHouse(
                    houseId = HouseId.of(player),
                    player = player,
                    name = HouseName("Ravenscar"),
                    seat = Location(59.33, 18.07),
                    banner = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT),
                    worldTime = today,
                    recordedAt = noon,
                ),
                Provenance.startedBy(UUID.randomUUID()),
            )
        }
        streams.written.clear()
        return streams to service
    }

    fun sent(n: Int) = Provenance.startedBy(UUID.fromString("1c000001-0000-4000-8000-%012d".format(n)))

    "taking a key figure in writes the appearance and then the tie, in the one story of the command" {
        val (streams, service) = world()

        val id = service.add(ada, sent(1))

        id shouldBe CharacterId.broughtIn(HouseId.of(ada), sent(1).commandId)
        streams.written shouldHaveSize 2
        streams.written[0].first.shouldBeInstanceOf<CharacterAppeared>().characterId shouldBe id
        streams.written[1].first.shouldBeInstanceOf<HouseGainedKeyFigure>().characterId shouldBe id
        streams.written.map { it.second }.toSet() shouldBe setOf(sent(1))
    }

    "a full house writes nothing at all, not even a character nobody holds" {
        val (streams, service) = world()
        (1..HouseDecider.MOST_KEY_FIGURES).forEach { service.add(ada, sent(it)) }
        streams.written.clear()

        shouldThrow<HouseError.TooManyKeyFigures> { service.add(ada, sent(10)) }
        streams.written shouldHaveSize 0
    }

    "a player with no house is refused before anybody is brought into the world" {
        val (streams, service) = world()
        val nobody = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8f"))

        shouldThrow<HouseError.NoSuchHouse> { service.add(nobody, sent(1)) }
        streams.written shouldHaveSize 0
    }

    "the same command sent again finishes what the first left undone, and never makes a twin" {
        val (streams, service) = world()
        val first = service.add(ada, sent(1))

        service.add(ada, sent(1)) shouldBe first
        streams.written shouldHaveSize 2
        streams.houses.getValue(HouseId.of(ada)).filterIsInstance<HouseGainedKeyFigure>() shouldHaveSize 1
    }

    "a lever on one of the house's own key figures reaches the character" {
        val (streams, service) = world()
        val agnes = service.add(ada, sent(1))
        streams.written.clear()

        service.changeStat(ada, agnes, Stat.PIETY, 2, sent(2))
        service.age(ada, agnes, 10, sent(3))
        service.changePortrait(ada, agnes, "woman-02", sent(4))
        service.kill(ada, agnes, "struck down from the debug panel", sent(5))

        streams.written.map { it.first::class } shouldBe listOf(
            CharacterStatChanged::class,
            CharacterAged::class,
            CharacterPortraitChanged::class,
            CharacterDied::class,
        )
        // Asking the house writes nothing to it: every event above is on the character's stream.
        streams.houses.getValue(HouseId.of(ada)) shouldHaveSize 2
    }

    "a lever on anybody else's key figure is refused by the player's own house, and nothing is written" {
        val (streams, service) = world()
        val beasFigure = service.add(bea, sent(1))
        streams.written.clear()

        shouldThrow<HouseError.NoSuchKeyFigure> { service.changeStat(ada, beasFigure, Stat.PIETY, 1, sent(2)) }
        shouldThrow<HouseError.NoSuchKeyFigure> { service.kill(ada, beasFigure, "envy", sent(3)) }
        streams.written shouldHaveSize 0
    }

    "a house loses a key figure on the mourning's word, and nobody it does not hold" {
        val (streams, service) = world()
        val agnes = service.add(ada, sent(1))
        streams.written.clear()

        service.loseHeldBy(HouseId.of(ada), agnes, sent(2))

        streams.written.single().first.shouldBeInstanceOf<HouseLostKeyFigure>().characterId shouldBe agnes
        shouldThrow<HouseError.NoSuchKeyFigure> { service.loseHeldBy(HouseId.of(bea), agnes, sent(3)) }
    }
})
