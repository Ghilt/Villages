package villages.application

import villages.domain.Rarity

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
)
