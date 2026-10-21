package villages.application

import villages.application.fate.FateCatalogue
import villages.domain.LevelSpec
import villages.domain.Rarity
import villages.domain.Significance
import villages.domain.StructureCatalogue
import villages.domain.StructureSpec
import villages.domain.StructureType
import villages.domain.Resource
import villages.domain.challenge.ChallengeRules
import villages.domain.challenge.SliceStart

/**
 * The balance the application's tests play by: the first draft's numbers, which `world/catalogues/balance.json` began
 * from on 2026-10-16. Its own here, so a retune of the file never moves a test.
 */
val TEST_BALANCE = Balance(
    roll = Balance.Roll(
        price = 10,
        hand = 3,
        odds = mapOf(Rarity.COMMON to 70, Rarity.UNCOMMON to 22, Rarity.RARE to 7, Rarity.LEGENDARY to 1),
        grants = mapOf(Rarity.COMMON to 15L, Rarity.UNCOMMON to 40L, Rarity.RARE to 120L, Rarity.LEGENDARY to 400L),
    ),
    omens = Balance.Omens(
        weakForDays = 730,
        piousAt = 100,
        groundPresent = 0.15,
        riversWithinKm = 400.0,
        housesWithinKm = 150.0,
        mostHouses = 3,
        townsWithinKm = 150.0,
        mostTowns = 2,
    ),
    islands = Balance.Islands(smallerThanKm2 = 4_000_000.0),
    newcomers = Balance.Newcomers(youngest = 18, oldest = 50),
    challenge = ChallengeRules(100.0, 10.0, 0.2, 0.5, 10.0, SliceStart(50.0, 50.0, 3)),
    houseBots = Balance.HouseBots(count = 300, apartKm = 60.0, beyondRuinKm = 6.0),
    settlements = Balance.Settlements(clearKm = 4.0),
)

/** A fate catalogue the shelf's tests can take on: three grants of every rarity, in Hearth. */
val TEST_FATE = FateCatalogue(
    pools = listOf(FateCatalogue.PoolSpec("Hearth", emptyList())),
    actions = Rarity.entries.flatMap { rarity ->
        (1..3).map { n ->
            FateCatalogue.ActionSpec(
                "${rarity.name.lowercase()}$n", rarity, listOf("Hearth"), "Collect", "Paid.", FateCatalogue.Deals.Grant(Resource.WEALTH),
            )
        }
    },
)

/** The names the tests' newcomers are given: the first and the last of each list the file began with. */
val TEST_NAMES = CharacterNames(women = listOf("Agnes", "Ursula"), men = listOf("Anton", "Wilhelm"), family = listOf("Achterberg", "Ystad"))

/** A catalogue of structures the tests can take on: a castle of one level, which the abbot's quest asks to be held. */
val TEST_STRUCTURES = StructureCatalogue(
    mapOf(StructureType("castle") to StructureSpec(listOf(LevelSpec(Significance(20.0), 34.0, emptyMap())), emptyList())),
)
