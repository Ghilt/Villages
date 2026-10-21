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
    val silences: Boolean get() = false

    /** On a summon: it acts only while the happening has its own aspect, as a kind that needs a matching aspect does. */
    val needsMatch: Boolean get() = false
}

/** Silenced: the summon does not act. The Enforcer's. */
private object Silenced : LastingBehaviour {
    override val silences = true
}

/** Under curfew: the summon acts only while the happening has its own aspect. Curfew's. */
private object UnderCurfew : LastingBehaviour {
    override val needsMatch = true
}

internal val lastingBehaviours: Map<String, LastingBehaviour> = mapOf("silenced" to Silenced, "underCurfew" to UnderCurfew)

/** Whether [summon] bears something that silences it. */
internal fun silenced(summon: Summon): Boolean = summon.bearing.keys.any { lastingBehaviours[it]?.silences == true }

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
