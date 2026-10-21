package villages.domain.challenge

import kotlin.math.max

/**
 * Buffs and debuffs: what each does, in code, by its id in the catalogue, which gives it its numbers and says what it
 * goes on; and how the contest puts one on, holds it for its seconds and lifts it. The same one put on again lasts from
 * then and never stacks; different ones add up. See `docs/plans/challenge-matching.md`.
 */

/** What a buff or a debuff does while it is on, each hook nothing unless it says otherwise. */
interface LastingBehaviour {
    /** The numbers it reads from its catalogue entry, which the catalogue must give it. */
    val reads: Set<String> get() = emptySet()

    /** On a summon: it does not act. */
    val stuns: Boolean get() = false

    /** On a summon: it acts only while the happening has its own aspect, as a kind that needs a matching aspect does. */
    val needsMatch: Boolean get() = false

    /** How much of itself its bearer still is while it is on, from nought to one, by its [entry]'s numbers. */
    fun effectiveness(entry: Lasting): Double = 1.0

    /** On a summon: the integrity it loses each time it acts, by its [entry]'s numbers. */
    fun wears(entry: Lasting): Double = 0.0
}

/** Stunned: the summon does not act. The Enforcer's. */
private object Stunned : LastingBehaviour {
    override val stuns = true
}

/** Aspect-bound: the summon acts only while the happening has its own aspect. Curfew's. */
private object AspectBound : LastingBehaviour {
    override val needsMatch = true
}

/** Weakened: its bearer works `percent` less, as long as it is on; a share past a hundred leaves it nothing. Seen Through's. */
private object Weakened : LastingBehaviour {
    override val reads = setOf("percent")

    override fun effectiveness(entry: Lasting): Double = (1.0 - entry.number("percent") / 100.0).coerceIn(0.0, 1.0)
}

/** Eroding: each act costs the summon `integrity`, and at nothing it is gone. The Wild Remembers'. */
private object Eroding : LastingBehaviour {
    override val reads = setOf("integrity")

    override fun wears(entry: Lasting): Double = entry.number("integrity")
}

internal val lastingBehaviours: Map<String, LastingBehaviour> =
    mapOf("stunned" to Stunned, "aspectBound" to AspectBound, "weakened" to Weakened, "eroding" to Eroding)

/** How much of itself what bears [bearing] still is: each buff's and debuff's share of itself, all of them together. */
internal fun Contest.effectiveness(bearing: Map<String, Int>): Double =
    bearing.keys.fold(1.0) { left, id -> left * (lastingBehaviours[id]?.effectiveness(catalogue.lasting(id)!!) ?: 1.0) }

/** What [summon] asks to lose of its integrity as it acts: each debuff that wears it, saying which. */
internal fun Contest.wearOf(summon: Summon): List<Change> = summon.bearing.keys.mapNotNull { id ->
    val worn = lastingBehaviours[id]?.wears(catalogue.lasting(id)!!) ?: 0.0
    if (worn > 0.0) Change.WearSummon(summon.serial, worn, id) else null
}

/** Lifts every debuff from [change]'s side, its slices and its summons, saying each. */
internal fun Contest.cleanse(change: Change.Cleanse) {
    val bearers = field.filter { it.side == change.side }.map { it.actor to it.bearing } +
        bearings.getValue(change.side).mapIndexed { slice, bearing -> Actor.OfSlice(change.side, slice) to bearing }
    bearers.forEach { (bearer, bearing) ->
        bearing.keys.filter { it in catalogue.debuffs }.forEach { id ->
            bearing.remove(id)
            say(What.CLEANSED, change.side, change.actor, change.effect, bearer, status = id)
        }
    }
}

/** Whether [summon] bears something that stuns it. */
internal fun stunned(summon: Summon): Boolean = summon.bearing.keys.any { lastingBehaviours[it]?.stuns == true }

/** Whether [summon] acts only while the happening has its own aspect: by its kind's mark, or by a debuff it bears. */
internal fun Contest.needsMatch(summon: Summon): Boolean =
    catalogue.summons[summon.kind]?.matching == true || summon.bearing.keys.any { lastingBehaviours[it]?.needsMatch == true }

/** Puts [change]'s buff or debuff on its bearer until its second, the later of two ends when it is on already, and says so. */
internal fun Contest.putOn(change: Change.PutOn) {
    val bearing = bearingOf(change.target) ?: return
    bearing[change.lasting] = max(bearing[change.lasting] ?: -1, change.until)
    val what = if (change.lasting in catalogue.debuffs) What.DEBUFFED else What.BUFFED
    say(what, change.side, change.actor, change.effect, change.target, (change.until - second).toDouble(), status = change.lasting)
}

/** Lifts every buff and debuff whose seconds are up as the second begins, saying each. */
internal fun Contest.lift() {
    field.forEach { summon -> liftFrom(summon.bearing, summon.side, summon.actor) }
    Side.entries.forEach { side -> bearings.getValue(side).forEachIndexed { slice, bearing -> liftFrom(bearing, side, Actor.OfSlice(side, slice)) } }
}

private fun Contest.liftFrom(bearing: MutableMap<String, Int>, side: Side, bearer: Actor) {
    bearing.filterValues { it < second }.keys.forEach { lasting ->
        bearing.remove(lasting)
        say(What.LIFTED, side, bearer, status = lasting)
    }
}

/** What [bearer] bears, its buffs' and debuffs' ids each with the last second it lasts; none for a summon gone. */
internal fun Contest.bearingOf(bearer: Actor): MutableMap<String, Int>? = when (bearer) {
    is Actor.OfSummon -> field.firstOrNull { it.serial == bearer.serial }?.bearing
    is Actor.OfSlice -> bearings.getValue(bearer.side)[bearer.index]
    Actor.TheChallenge -> null
}
