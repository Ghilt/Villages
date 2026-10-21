package villages.domain.challenge

import villages.domain.Stat

/**
 * The content the engine's specs fight with: every pair as the first draft has it, marks and all, and the first draft's rules. Its own here, so a retune of `world/catalogues/` never moves a spec.
 */
val TEST_CATALOGUE = ChallengeCatalogue(
    effects = listOf(
        ChallengeEffect("violence.sellswords", Aspect.VIOLENCE, Fires.TRIGGER, summons = "mercenary", needs = Needs.MATCH),
        ChallengeEffect("violence.noQuarter", Aspect.VIOLENCE, Fires.PASSIVE, mapOf("chance" to 25.0), needs = Needs.MATCH),
        ChallengeEffect("diplomacy.envoy", Aspect.DIPLOMACY, Fires.TRIGGER, slot = ChallengeSlot(Fits.KEY_FIGURE, Stat.KINDNESS)),
        ChallengeEffect("diplomacy.sweeterTerms", Aspect.DIPLOMACY, Fires.TRIGGER, mapOf("strong" to 50.0, "weak" to 20.0)),
        ChallengeEffect("diplomacy.parley", Aspect.DIPLOMACY, Fires.PASSIVE, mapOf("perSecond" to 2.0, "power" to 5.0)),
        ChallengeEffect("holy.rebuke", Aspect.HOLY, Fires.PASSIVE, mapOf("chance" to 20.0, "integrity" to 10.0), needs = Needs.MATCH),
        ChallengeEffect("holy.ordination", Aspect.HOLY, Fires.TRIGGER, summons = "priest", needs = Needs.MATCH),
        ChallengeEffect("holy.sanctuary", Aspect.HOLY, Fires.PASSIVE, mapOf("piety" to 5.0), slot = ChallengeSlot(Fits.STRUCTURE, onTheLine = true), needs = Needs.MATCH),
        ChallengeEffect("reason.counsel", Aspect.REASON, Fires.TRIGGER, slot = ChallengeSlot(Fits.KEY_FIGURE, Stat.REASON)),
        ChallengeEffect("reason.refutation", Aspect.REASON, Fires.PASSIVE, mapOf("chance" to 20.0)),
        ChallengeEffect("reason.seenThrough", Aspect.REASON, Fires.PASSIVE, mapOf("chance" to 20.0, "seconds" to 10.0), puts = "weakened"),
        ChallengeEffect("authority.watch", Aspect.AUTHORITY, Fires.TRIGGER, summons = "enforcer", needs = Needs.MATCH),
        ChallengeEffect("authority.curfew", Aspect.AUTHORITY, Fires.TRIGGER, mapOf("seconds" to 8.0), needs = Needs.MATCH, puts = "aspectBound"),
        ChallengeEffect("authority.firmHand", Aspect.AUTHORITY, Fires.TRIGGER, mapOf("seconds" to 10.0), needs = Needs.MATCH, puts = "penalised"),
        ChallengeEffect("nature.dread", Aspect.NATURE, Fires.TRIGGER, mapOf("seconds" to 8.0), needs = Needs.MATCH, puts = "weakened"),
        ChallengeEffect("freedom.commons", Aspect.FREEDOM, Fires.TRIGGER, summons = "rebel"),
        ChallengeEffect("freedom.ownWill", Aspect.FREEDOM, Fires.PASSIVE),
        ChallengeEffect("greed.countingHouse", Aspect.GREED, Fires.TRIGGER, mapOf("wealth" to 5.0), slot = ChallengeSlot(Fits.STRUCTURE, onTheLine = true), needs = Needs.MATCH),
        ChallengeEffect("greed.farmTaxes", Aspect.GREED, Fires.TRIGGER, summons = "collector", needs = Needs.MATCH),
        ChallengeEffect("greed.pickBones", Aspect.GREED, Fires.PASSIVE, mapOf("amount" to 10.0)),
        ChallengeEffect("generosity.patron", Aspect.GENEROSITY, Fires.TRIGGER, slot = ChallengeSlot(Fits.KEY_FIGURE, Stat.KINDNESS)),
        ChallengeEffect("generosity.alms", Aspect.GENEROSITY, Fires.TRIGGER, summons = "benefactor"),
        ChallengeEffect("generosity.tend", Aspect.GENEROSITY, Fires.TRIGGER),
        ChallengeEffect("nature.wildHunt", Aspect.NATURE, Fires.TRIGGER, summons = "predator", needs = Needs.MATCH),
        ChallengeEffect("nature.teeming", Aspect.NATURE, Fires.PASSIVE, mapOf("chance" to 20.0), summons = "creature", needs = Needs.MATCH),
        ChallengeEffect("industry.engines", Aspect.INDUSTRY, Fires.TRIGGER, summons = "machine", needs = Needs.MATCH),
        ChallengeEffect("industry.works", Aspect.INDUSTRY, Fires.TRIGGER, slot = ChallengeSlot(Fits.STRUCTURE, onTheLine = true), needs = Needs.MATCH),
        ChallengeEffect("industry.wellOiled", Aspect.INDUSTRY, Fires.PASSIVE, mapOf("chance" to 20.0, "seconds" to 10.0), puts = "hastened"),
        ChallengeEffect("violence.warDrums", Aspect.VIOLENCE, Fires.TRIGGER, mapOf("seconds" to 10.0), needs = Needs.MATCH, puts = "hastened"),
        ChallengeEffect("reason.foresight", Aspect.REASON, Fires.TRIGGER, mapOf("seconds" to 8.0), needs = Needs.MATCH, puts = "warded"),
        ChallengeEffect("authority.fealty", Aspect.AUTHORITY, Fires.TRIGGER, mapOf("seconds" to 15.0), needs = Needs.MATCH, puts = "steadfast"),
        ChallengeEffect("freedom.wordSpreads", Aspect.FREEDOM, Fires.TRIGGER, mapOf("seconds" to 15.0), puts = "echoing"),
        ChallengeEffect("violence.saberRattling", Aspect.VIOLENCE, Fires.TRIGGER, mapOf("seconds" to 10.0, "amount" to 15.0), needs = Needs.ANTI, puts = "weakened"),
        ChallengeEffect("diplomacy.ceasefire", Aspect.DIPLOMACY, Fires.TRIGGER, mapOf("seconds" to 4.0), needs = Needs.ANTI, puts = "stunned"),
        ChallengeEffect("holy.miracle", Aspect.HOLY, Fires.TRIGGER, mapOf("seconds" to 8.0, "amount" to 25.0), needs = Needs.ANTI, puts = "empowered"),
        ChallengeEffect("reason.doubt", Aspect.REASON, Fires.TRIGGER, mapOf("seconds" to 10.0, "amount" to 15.0), needs = Needs.ANTI, puts = "weakened"),
        ChallengeEffect("authority.martialLaw", Aspect.AUTHORITY, Fires.TRIGGER, mapOf("seconds" to 4.0, "amount" to 20.0), needs = Needs.ANTI, puts = "stunned"),
        ChallengeEffect("freedom.defiance", Aspect.FREEDOM, Fires.TRIGGER, mapOf("seconds" to 8.0, "amount" to 20.0), needs = Needs.ANTI, puts = "hastened"),
        ChallengeEffect("greed.profiteering", Aspect.GREED, Fires.TRIGGER, mapOf("amount" to 5.0), needs = Needs.ANTI),
        ChallengeEffect("generosity.forgiveness", Aspect.GENEROSITY, Fires.TRIGGER, needs = Needs.ANTI),
        ChallengeEffect("nature.overgrowth", Aspect.NATURE, Fires.TRIGGER, mapOf("seconds" to 10.0), needs = Needs.ANTI, puts = "eroding"),
        ChallengeEffect("industry.clearLand", Aspect.INDUSTRY, Fires.TRIGGER, mapOf("seconds" to 10.0, "amount" to 15.0), needs = Needs.ANTI, puts = "weakened"),
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
        "creature" to SummonSpec(Aspect.NATURE, mapOf("pulls" to 3.0), needs = Needs.MATCH),
    ),
    kinds = emptyMap(),
    buffs = mapOf(
        EMPOWERED to Lasting(setOf(Bearer.SLICE, Bearer.SUMMON), mapOf("percent" to 50.0)),
        "hastened" to Lasting(setOf(Bearer.SUMMON), mapOf("rate" to 50.0)),
        "echoing" to Lasting(setOf(Bearer.SLICE), mapOf("chance" to 25.0)),
        "warded" to Lasting(setOf(Bearer.SLICE, Bearer.SUMMON)),
        "steadfast" to Lasting(setOf(Bearer.SUMMON)),
    ),
    debuffs = mapOf(
        "stunned" to Lasting(setOf(Bearer.SUMMON)),
        "aspectBound" to Lasting(setOf(Bearer.SUMMON)),
        "weakened" to Lasting(setOf(Bearer.SUMMON, Bearer.SLICE), mapOf("percent" to 30.0)),
        "penalised" to Lasting(setOf(Bearer.SLICE), mapOf("amount" to 8.0)),
        "eroding" to Lasting(setOf(Bearer.SUMMON), mapOf("integrity" to 4.0)),
    ),
)

val TEST_RULES = ChallengeRules(100.0, 10.0, 0.2, 0.5, 10.0, SliceStart(50.0, 50.0, 3))

/** The test catalogue with one of a summon's numbers changed. */
fun ChallengeCatalogue.withSummon(summon: String, number: String, value: Double): ChallengeCatalogue = copy(
    summons = summons.mapValues { (id, spec) -> if (id == summon) spec.copy(numbers = spec.numbers + (number to value)) else spec },
)

/** The test catalogue with no marks: every effect and summon works in every happening, as a spec of what one does wants. */
val ANYWHERE = TEST_CATALOGUE.copy(
    effects = TEST_CATALOGUE.effects.map { it.copy(needs = null) },
    summons = TEST_CATALOGUE.summons.mapValues { (_, spec) -> spec.copy(needs = null) },
)

/** The test catalogue with one effect's mark set: what it needs of the happening, nothing to work in any. */
fun ChallengeCatalogue.marked(effect: String, needs: Needs?): ChallengeCatalogue = copy(
    effects = effects.map { if (it.id == effect) it.copy(needs = needs) else it },
)

/** The test catalogue with one of a buff's numbers changed. */
fun ChallengeCatalogue.withBuff(buff: String, number: String, value: Double): ChallengeCatalogue = copy(
    buffs = buffs.mapValues { (id, entry) -> if (id == buff) entry.copy(numbers = entry.numbers + (number to value)) else entry },
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
