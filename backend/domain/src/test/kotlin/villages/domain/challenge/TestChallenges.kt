package villages.domain.challenge

import villages.domain.Stat

/**
 * The content the engine's specs fight with: the pairs built so far as the first draft has them, one effect not
 * built yet, and the first draft's rules. Its own here, so a retune of `world/catalogues/` never moves a spec.
 */
val TEST_CATALOGUE = ChallengeCatalogue(
    effects = listOf(
        ChallengeEffect("violence.sellswords", Aspect.VIOLENCE, Fires.TRIGGER, summons = "mercenary"),
        ChallengeEffect("violence.noQuarter", Aspect.VIOLENCE, Fires.PASSIVE, mapOf("chance" to 25.0)),
        ChallengeEffect("violence.spoils", Aspect.VIOLENCE, Fires.PASSIVE, mapOf("amount" to 30.0)),
        ChallengeEffect("diplomacy.envoy", Aspect.DIPLOMACY, Fires.TRIGGER, slot = ChallengeSlot(Fits.KEY_FIGURE, Stat.KINDNESS)),
        ChallengeEffect("diplomacy.sweeterTerms", Aspect.DIPLOMACY, Fires.TRIGGER, mapOf("strong" to 50.0, "weak" to 20.0)),
        ChallengeEffect("diplomacy.parley", Aspect.DIPLOMACY, Fires.PASSIVE, mapOf("perSecond" to 2.0, "power" to 5.0)),
        ChallengeEffect("holy.rebuke", Aspect.HOLY, Fires.PASSIVE, mapOf("chance" to 20.0, "integrity" to 10.0)),
        ChallengeEffect("holy.ordination", Aspect.HOLY, Fires.TRIGGER, summons = "priest"),
        ChallengeEffect("holy.sanctuary", Aspect.HOLY, Fires.PASSIVE, mapOf("piety" to 5.0), slot = ChallengeSlot(Fits.STRUCTURE, onTheLine = true)),
        ChallengeEffect("reason.counsel", Aspect.REASON, Fires.TRIGGER, slot = ChallengeSlot(Fits.KEY_FIGURE, Stat.REASON)),
        ChallengeEffect("reason.refutation", Aspect.REASON, Fires.PASSIVE, mapOf("chance" to 20.0)),
        ChallengeEffect("reason.seenThrough", Aspect.REASON, Fires.PASSIVE, mapOf("chance" to 20.0, "amount" to 5.0)),
        ChallengeEffect("authority.watch", Aspect.AUTHORITY, Fires.TRIGGER, summons = "enforcer"),
        ChallengeEffect("authority.decree", Aspect.AUTHORITY, Fires.PASSIVE, mapOf("chance" to 25.0)),
        ChallengeEffect("authority.firmHand", Aspect.AUTHORITY, Fires.PASSIVE, mapOf("power" to 5.0)),
        ChallengeEffect("freedom.commons", Aspect.FREEDOM, Fires.TRIGGER, summons = "rebel"),
        ChallengeEffect("freedom.againstTheGrain", Aspect.FREEDOM, Fires.PASSIVE, mapOf("amount" to 20.0)),
        ChallengeEffect("freedom.ownWill", Aspect.FREEDOM, Fires.PASSIVE),
        ChallengeEffect("greed.pickBones", Aspect.GREED, Fires.PASSIVE, mapOf("amount" to 10.0)),
    ),
    summons = mapOf(
        "mercenary" to SummonSpec(Aspect.VIOLENCE, mapOf("pulls" to 10.0)),
        "priest" to SummonSpec(Aspect.HOLY, mapOf("share" to 1.0)),
        "enforcer" to SummonSpec(Aspect.AUTHORITY, mapOf("costs" to 5.0, "silences" to 3.0)),
        "rebel" to SummonSpec(Aspect.FREEDOM, mapOf("pulls" to 5.0, "behind" to 10.0)),
    ),
    kinds = emptyMap(),
)

val TEST_RULES = ChallengeRules(1.5, 100.0, 10.0, 0.2, 0.5, 10.0, SliceStart(50.0, 50.0, 3))

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
