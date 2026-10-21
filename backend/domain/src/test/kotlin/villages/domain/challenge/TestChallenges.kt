package villages.domain.challenge

import villages.domain.Stat

/**
 * The content the engine's specs fight with: every pair as the first draft has it, marks and all, and the first draft's rules. Its own here, so a retune of `world/catalogues/` never moves a spec.
 */
val TEST_CATALOGUE = ChallengeCatalogue(
    effects = listOf(
        ChallengeEffect("violence.sellswords", Aspect.VIOLENCE, Fires.TRIGGER, summons = "mercenary", matching = true),
        ChallengeEffect("violence.noQuarter", Aspect.VIOLENCE, Fires.PASSIVE, mapOf("chance" to 25.0), matching = true),
        ChallengeEffect("violence.spoils", Aspect.VIOLENCE, Fires.PASSIVE, mapOf("amount" to 30.0)),
        ChallengeEffect("diplomacy.envoy", Aspect.DIPLOMACY, Fires.TRIGGER, slot = ChallengeSlot(Fits.KEY_FIGURE, Stat.KINDNESS)),
        ChallengeEffect("diplomacy.sweeterTerms", Aspect.DIPLOMACY, Fires.TRIGGER, mapOf("strong" to 50.0, "weak" to 20.0)),
        ChallengeEffect("diplomacy.parley", Aspect.DIPLOMACY, Fires.PASSIVE, mapOf("perSecond" to 2.0, "power" to 5.0)),
        ChallengeEffect("holy.rebuke", Aspect.HOLY, Fires.PASSIVE, mapOf("chance" to 20.0, "integrity" to 10.0), matching = true),
        ChallengeEffect("holy.ordination", Aspect.HOLY, Fires.TRIGGER, summons = "priest", matching = true),
        ChallengeEffect("holy.sanctuary", Aspect.HOLY, Fires.PASSIVE, mapOf("piety" to 5.0), slot = ChallengeSlot(Fits.STRUCTURE, onTheLine = true), matching = true),
        ChallengeEffect("reason.counsel", Aspect.REASON, Fires.TRIGGER, slot = ChallengeSlot(Fits.KEY_FIGURE, Stat.REASON)),
        ChallengeEffect("reason.refutation", Aspect.REASON, Fires.PASSIVE, mapOf("chance" to 20.0)),
        ChallengeEffect("reason.seenThrough", Aspect.REASON, Fires.PASSIVE, mapOf("chance" to 20.0, "seconds" to 10.0), puts = "weakened"),
        ChallengeEffect("authority.watch", Aspect.AUTHORITY, Fires.TRIGGER, summons = "enforcer", matching = true),
        ChallengeEffect("authority.curfew", Aspect.AUTHORITY, Fires.TRIGGER, mapOf("seconds" to 8.0), matching = true, puts = "aspectBound"),
        ChallengeEffect("authority.firmHand", Aspect.AUTHORITY, Fires.PASSIVE, mapOf("power" to 5.0), matching = true),
        ChallengeEffect("freedom.commons", Aspect.FREEDOM, Fires.TRIGGER, summons = "rebel"),
        ChallengeEffect("freedom.againstTheGrain", Aspect.FREEDOM, Fires.PASSIVE, mapOf("amount" to 20.0)),
        ChallengeEffect("freedom.ownWill", Aspect.FREEDOM, Fires.PASSIVE),
        ChallengeEffect("greed.countingHouse", Aspect.GREED, Fires.TRIGGER, mapOf("wealth" to 5.0), slot = ChallengeSlot(Fits.STRUCTURE, onTheLine = true), matching = true),
        ChallengeEffect("greed.farmTaxes", Aspect.GREED, Fires.TRIGGER, summons = "collector", matching = true),
        ChallengeEffect("greed.pickBones", Aspect.GREED, Fires.PASSIVE, mapOf("amount" to 10.0)),
        ChallengeEffect("generosity.patron", Aspect.GENEROSITY, Fires.TRIGGER, slot = ChallengeSlot(Fits.KEY_FIGURE, Stat.KINDNESS)),
        ChallengeEffect("generosity.alms", Aspect.GENEROSITY, Fires.TRIGGER, summons = "benefactor"),
        ChallengeEffect("generosity.remembered", Aspect.GENEROSITY, Fires.PASSIVE, mapOf("amount" to 15.0)),
        ChallengeEffect("generosity.tend", Aspect.GENEROSITY, Fires.TRIGGER),
        ChallengeEffect("nature.wildHunt", Aspect.NATURE, Fires.TRIGGER, summons = "predator", matching = true),
        ChallengeEffect("nature.teeming", Aspect.NATURE, Fires.PASSIVE, mapOf("chance" to 20.0), summons = "creature", matching = true),
        ChallengeEffect("nature.wildRemembers", Aspect.NATURE, Fires.PASSIVE, mapOf("seconds" to 10.0), puts = "eroding"),
        ChallengeEffect("industry.engines", Aspect.INDUSTRY, Fires.TRIGGER, summons = "machine", matching = true),
        ChallengeEffect("industry.works", Aspect.INDUSTRY, Fires.TRIGGER, slot = ChallengeSlot(Fits.STRUCTURE, onTheLine = true), matching = true),
        ChallengeEffect("industry.wellOiled", Aspect.INDUSTRY, Fires.PASSIVE, mapOf("chance" to 20.0, "amount" to 5.0)),
    ),
    summons = mapOf(
        "mercenary" to SummonSpec(Aspect.VIOLENCE, mapOf("pulls" to 10.0)),
        "priest" to SummonSpec(Aspect.HOLY, mapOf("share" to 1.0)),
        "enforcer" to SummonSpec(Aspect.AUTHORITY, mapOf("costs" to 5.0, "stuns" to 3.0), puts = "stunned"),
        "rebel" to SummonSpec(Aspect.FREEDOM, mapOf("pulls" to 5.0, "behind" to 10.0)),
        "collector" to SummonSpec(Aspect.GREED, mapOf("costs" to 3.0, "deposits" to 6.0)),
        "benefactor" to SummonSpec(Aspect.GENEROSITY, mapOf("pulls" to 5.0, "behind" to 10.0)),
        "machine" to SummonSpec(Aspect.INDUSTRY, mapOf("pulls" to 10.0)),
        "predator" to SummonSpec(Aspect.NATURE, mapOf("pulls" to 5.0, "kills" to 20.0)),
        "creature" to SummonSpec(Aspect.NATURE, mapOf("pulls" to 3.0), matching = true),
    ),
    kinds = emptyMap(),
    debuffs = mapOf(
        "stunned" to Lasting(Bearer.SUMMON),
        "aspectBound" to Lasting(Bearer.SUMMON),
        "weakened" to Lasting(Bearer.SUMMON, mapOf("percent" to 30.0)),
        "eroding" to Lasting(Bearer.SUMMON, mapOf("integrity" to 4.0)),
    ),
)

val TEST_RULES = ChallengeRules(1.5, 100.0, 10.0, 0.2, 0.5, 10.0, SliceStart(50.0, 50.0, 3))

/** The test catalogue with one of a summon's numbers changed. */
fun ChallengeCatalogue.withSummon(summon: String, number: String, value: Double): ChallengeCatalogue = copy(
    summons = summons.mapValues { (id, spec) -> if (id == summon) spec.copy(numbers = spec.numbers + (number to value)) else spec },
)

/** The test catalogue with no marks: every effect and summon works in every happening, as a spec of what one does wants. */
val ANYWHERE = TEST_CATALOGUE.copy(
    effects = TEST_CATALOGUE.effects.map { it.copy(matching = false) },
    summons = TEST_CATALOGUE.summons.mapValues { (_, spec) -> spec.copy(matching = false) },
)

/** The test catalogue with one effect's mark set: whether it needs a matching aspect. */
fun ChallengeCatalogue.marked(effect: String, matching: Boolean): ChallengeCatalogue = copy(
    effects = effects.map { if (it.id == effect) it.copy(matching = matching) else it },
)

/** The test catalogue with one of a debuff's numbers changed. */
fun ChallengeCatalogue.withDebuff(debuff: String, number: String, value: Double): ChallengeCatalogue = copy(
    debuffs = debuffs.mapValues { (id, entry) -> if (id == debuff) entry.copy(numbers = entry.numbers + (number to value)) else entry },
)

/** The test catalogue with one of its numbers changed: a chance made certain, so a spec need not hunt for a seed. */
fun ChallengeCatalogue.with(effect: String, number: String, value: Double): ChallengeCatalogue = copy(
    effects = effects.map { if (it.id == effect) it.copy(numbers = it.numbers + (number to value)) else it },
)

fun slice(
    aspect: Aspect,
    vararg effects: String,
    power: Double = 50.0,
    integrity: Double = 50.0,
    summonCount: Int = 3,
    slotted: Map<String, StandIn> = emptyMap(),
) = ChallengeSlice(aspect, power, integrity, summonCount, effects.toList(), slotted)

fun fight(
    a: List<ChallengeSlice>,
    b: List<ChallengeSlice>,
    seconds: Int,
    vararg happenings: Happening,
    seed: Long = 1,
    catalogue: ChallengeCatalogue = TEST_CATALOGUE,
): ChallengeResult = Challenge.resolve(ChallengeSetup(a, b, Progression(seconds, happenings.toList())), seed, catalogue, TEST_RULES)

/** A side that brings a slice that does nothing at all: Trusted Envoy with nobody in its slot. */
val IDLE = listOf(slice(Aspect.DIPLOMACY, "diplomacy.envoy"))

fun ChallengeResult.saying(what: What): List<ChallengeMoment> = moments.filter { it.what == what }
