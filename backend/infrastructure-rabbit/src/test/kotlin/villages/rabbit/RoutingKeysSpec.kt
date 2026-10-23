package villages.rabbit

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.shouldBe
import villages.domain.Banner
import villages.domain.CharacterDied
import villages.domain.CharacterId
import villages.domain.CharacterMoved
import villages.domain.Charge
import villages.domain.Division
import villages.domain.Event
import villages.domain.HouseFounded
import villages.domain.HouseGainedVision
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.PlayerRolled
import villages.domain.Rarity
import villages.domain.RollId
import villages.domain.Significance
import villages.domain.StructureId
import villages.domain.StructureRaised
import villages.domain.StructureType
import villages.domain.Tincture
import villages.domain.VisionId
import villages.domain.WorldTime
import java.time.Instant
import java.util.UUID
import kotlin.reflect.KClass
import kotlin.reflect.full.primaryConstructor

/**
 * The routing key: an event's type and the cell of where it happened, a word a digit (decision record 0094). The
 * cell function here stands in for the one the app hands in, which `protocol` tests against the page's.
 */
class RoutingKeysSpec : StringSpec({
    val stockholm = Location(59.33, 18.07)
    val keys = RoutingKeys { place -> if (place == stockholm) "1203002113" else "3" }
    val agnes = CharacterId(UUID.fromString("cb732500-39bd-3b39-a838-bb89f719578f"))
    val noon = Instant.parse("2026-09-04T12:00:00Z")

    "an event that says where it happened is keyed by its type and its cell, a word a digit" {
        val moved = CharacterMoved(agnes, stockholm, Significance(40.0), WorldTime(653_705), noon)

        keys.of("villages.character.moved.v1", moved) shouldBe "character.moved.v1.1.2.0.3.0.0.2.1.1.3"
    }

    "an event that says nowhere, one the code could not read, and the wipe's marker end in none" {
        val died = CharacterDied(agnes, "a fever that did not break", WorldTime(653_705), noon)

        keys.of("villages.character.died.v1", died) shouldBe "character.died.v1.none"
        keys.of("villages.character.died.v1", null) shouldBe "character.died.v1.none"
        keys.of("villages.feed.marker", null) shouldBe "feed.marker.none"
    }

    "every event that carries a place is routed by it" {
        fun leaves(of: KClass<out Event>): List<KClass<out Event>> =
            of.sealedSubclasses.flatMap { if (it.isSealed) leaves(it) else listOf(it) }.distinct()

        val house = HouseId(UUID.randomUUID())
        val day = WorldTime(653_705)
        val atStockholm: List<Event> = listOf(
            HouseFounded(
                house, PlayerId(UUID.randomUUID()), HouseName("Ravenscar"), stockholm, Significance(40.0),
                Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT), emptyMap(), day, noon,
            ),
            HouseGainedVision(house, VisionId(UUID.randomUUID()), stockholm, 34.0, null, day, noon),
            CharacterMoved(agnes, stockholm, Significance(40.0), day, noon),
            StructureRaised(
                StructureId(UUID.randomUUID()), StructureType("castle"), "the castle at Stockholm", stockholm,
                Significance(20.0), 1, house, day, noon,
            ),
            PlayerRolled(
                house, PlayerId(UUID.randomUUID()), RollId(UUID.randomUUID()), emptyList(), Rarity.COMMON, stockholm, 25.0,
                day, noon,
            ),
        )
        atStockholm.forEach { placeOf(it) shouldBe stockholm }

        // One more here is an event placeOf has not been told of: it would be published as nowhere.
        val placed = leaves(Event::class).filter { event ->
            event.primaryConstructor!!.parameters.any { it.type.classifier == Location::class }
        }
        placed shouldContainExactlyInAnyOrder atStockholm.map { it::class }
    }
})
