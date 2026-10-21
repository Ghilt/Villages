package villages.application.bots

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.doubles.plusOrMinus
import io.kotest.matchers.shouldBe
import villages.application.Balance
import villages.application.fate.GroundMap
import villages.application.fate.NameKind
import villages.application.fate.PlaceName
import villages.application.fate.kmBetween
import villages.domain.Location
import kotlin.math.cos

/** Where the world's house bots stand. See decision record 0108. */
class HouseBotPlacesSpec : StringSpec({
    // 360 by 180 cells, a degree each, all ocean but for a continent from the meridian to 60 east, 60 north to 30
    // south, with a river across it at 20 east.
    val cells = ByteArray(360 * 180 * 2)
    for (y in 0 until 180) for (x in 0 until 360) cells[(y * 360 + x) * 2] = 1
    for (y in 30 until 120) for (x in 180 until 240) cells[(y * 360 + x) * 2] = 0
    for (y in 30 until 120) cells[(y * 360 + 200) * 2] = 2
    val ground = GroundMap(360, 180, mapOf(0 to "grassland", 1 to "ocean", 2 to "river"), cells)

    val ruins = RuinReach(perRootThousand = 1.25, least = 5.0, most = 42.0, ring = 0.3, unlisted = 3000, people = mapOf("Q1" to 1_000_000L, "Q3" to 50_000L))
    val bots = Balance.HouseBots(count = 300, apartKm = 200.0, beyondRuinKm = 6.0)

    fun town(id: String, rank: Double?, at: Location, name: String = id, of1790: Boolean = true) =
        PlaceName(id, NameKind.TOWN, name, null, rank, null, of1790, at, at, emptyList())

    val capital = town("Q1", 1.0, Location(10.0, 30.0), "Capital")
    val suburb = town("Q2", 2.0, Location(10.2, 30.2), "Suburb")
    val market = town("Q3", null, Location(40.0, 45.0), "Market")
    val atSea = town("Q4", 3.0, Location(-50.0, -100.0), "Atlantis")
    val ofToday = town("Q5", 4.0, Location(20.0, 50.0), "Newtown", of1790 = false)
    val longName = town("Q6", 5.0, Location(-10.0, 30.0), "A town whose name is far too long for a house")
    val coastal = town("Q7", 6.0, Location(0.0, 0.05), "Harbour")
    val towns = listOf(capital, suburb, market, atSea, ofToday, longName, coastal)

    "the towns of 1790 most important first, by their people and then the rest by rank, and none too near another" {
        HouseBotPlaces.of(towns, ground, ruins, bots).map { it.town } shouldBe listOf("Q1", "Q3", "Q7")
    }

    "each is named after its town, and its seat stands on land, past its ruin's edge by the balance's kilometres" {
        for (place in HouseBotPlaces.of(towns, ground, ruins, bots)) {
            val town = towns.single { it.id == place.town }
            place.name.value shouldBe town.name
            ground.at(place.seat).terrain shouldBe "grassland"
            kmBetween(town.at, place.seat) shouldBe (ruins.kmOf(town.id, town.at) + 6.0 plusOrMinus 0.5)
        }
    }

    "a town with only sea at its reach, a name no house can have, or one not of 1790 is passed over" {
        val ids = HouseBotPlaces.of(towns, ground, ruins, bots).map { it.town }
        listOf("Q4", "Q5", "Q6").none { it in ids } shouldBe true
    }

    "no more than the balance's count are taken, and none at all for nought" {
        HouseBotPlaces.of(towns, ground, ruins, bots.copy(count = 1)).map { it.town } shouldBe listOf("Q1")
        HouseBotPlaces.of(towns, ground, ruins, bots.copy(count = 0)) shouldBe emptyList()
    }

    "the same towns, ground and balance give the same bots, whatever order the towns come in" {
        HouseBotPlaces.of(towns.reversed(), ground, ruins, bots) shouldBe HouseBotPlaces.of(towns, ground, ruins, bots)
    }

    "nearer than apartKm is too near, so a smaller apart lets the suburb stand beside the capital" {
        HouseBotPlaces.of(towns, ground, ruins, bots.copy(apartKm = 0.0)).map { it.town } shouldBe listOf("Q1", "Q3", "Q2", "Q7")
    }
})

/** How far a town's ruins reach, as the page lays them out. See decision records 0104 and 0108. */
class RuinReachSpec : StringSpec({
    val ruins = RuinReach(perRootThousand = 1.25, least = 5.0, most = 42.0, ring = 0.3, unlisted = 3000, people = mapOf("Q1" to 1_000_000L, "Q2" to 10_000_000L))

    "a town the file does not list had as many people as it says, and its ruins reach at least the least" {
        ruins.kmOf("Q9", Location(0.0, 0.0)) shouldBe (5.0 * 1.3 * RuinReach.KM_A_UNIT plusOrMinus 1e-9)
    }

    "a listed town reaches by the root of its people, and never past the most" {
        ruins.kmOf("Q1", Location(0.0, 0.0)) shouldBe (1.25 * kotlin.math.sqrt(1000.0) * 1.3 * RuinReach.KM_A_UNIT plusOrMinus 1e-9)
        ruins.kmOf("Q2", Location(0.0, 0.0)) shouldBe (42.0 * 1.3 * RuinReach.KM_A_UNIT plusOrMinus 1e-9)
    }

    "a world unit is narrower on the ground away from the equator, so the same ruin reaches fewer kilometres there" {
        ruins.kmOf("Q1", Location(60.0, 0.0)) shouldBe (ruins.kmOf("Q1", Location(0.0, 0.0)) * cos(Math.toRadians(60.0)) plusOrMinus 1e-9)
    }
})
