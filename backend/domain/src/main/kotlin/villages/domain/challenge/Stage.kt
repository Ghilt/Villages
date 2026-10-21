package villages.domain.challenge

import kotlin.math.max

/**
 * Which slices match each happening, and what they have to work with: the power a slice has under the other side's
 * auras, and what an effect's slot gives. See decision record 0107.
 */

/**
 * Says which of [side]'s slices' aspects match the happening that began: those whose aspect it has. At a change, a
 * slice that matched the happening before and does not match this one may be held matching by one of its effects,
 * which Will of One's Own does once.
 */
internal fun Contest.match(side: Side) {
    val now = matching.getValue(side)
    val was = now.copyOf()
    setup.side(side).forEachIndexed { slice, spec ->
        val matches = happening.matches(spec.aspect)
        val holding = if (matches || previous == null || !was[slice]) {
            null
        } else {
            effectsOf(side, slice).firstOrNull { (effect, behaviour) -> behaviour.keepsMatching(scene(side, slice, effect)) }
        }
        now[slice] = matches || holding != null
        if (now[slice]) say(What.MATCHES, side, Actor.OfSlice(side, slice), holding?.first?.id)
    }
    works.remove(side)
}

/** The power of [side]'s slice [slice], lowered by the other side's auras that hold, and never below nothing. */
internal fun Contest.powerOf(side: Side, slice: Int): Double = max(0.0, setup.side(side)[slice].power - auras(side.other).values.sum())

/**
 * The auras of [side]'s working passives that hold now, each by its effect's id at its strongest: the same aura held by
 * two slices lowers the opponent once, and two different auras add up.
 */
internal fun Contest.auras(side: Side): Map<String, Double> =
    working(side).map { (slice, effect, behaviour) -> effect.id to behaviour.aura(scene(side, slice, effect)) }
        .filter { (_, lowered) -> lowered > 0.0 }
        .groupBy({ it.first }, { it.second })
        .mapValues { (_, lowered) -> lowered.max() }

/** Says each aura that came on or went off since the last second: a passive that lowers the other side's power while it holds. */
internal fun Contest.sayAuras() {
    val now = Side.entries.flatMap { side -> auras(side).map { (id, lowered) -> Triple(side, id, lowered) } }
    now.filter { (side, id, _) -> (side to id) !in aurasOn }.forEach { (side, id, lowered) ->
        val holder = setup.side(side).indexOfFirst { id in it.effects }
        say(What.AURA_ON, side, Actor.OfSlice(side, holder), id, amount = lowered)
    }
    val keys = now.map { (side, id, _) -> side to id }.toSet()
    (aurasOn - keys).forEach { (side, id) -> say(What.AURA_OFF, side, Actor.TheChallenge, id) }
    aurasOn = keys
}

/**
 * What [effect]'s slot on [side]'s slice [slice] gives when asked: a key figure lends their stat to the tug, or, when
 * the slot puts what is in it on the line, the building or the person comes on it, once in the challenge.
 */
internal fun Contest.slotOf(side: Side, slice: Int, effect: ChallengeEffect): List<Change> {
    val slot = effect.slot ?: return emptyList()
    val actor = Actor.OfSlice(side, slice)
    val standIn = setup.side(side)[slice].slotted[effect.id] ?: return listOf(Change.Say(What.EMPTY_SLOT, side, actor, effect.id))
    val scene = scene(side, slice, effect)
    val lent = (standIn as? StandIn.KeyFigure)?.let { figure -> slot.lends?.let { figure.stat(it).toDouble() } } ?: 0.0
    if (!slot.onTheLine) return listOf(Change.Pull(side, scene.boost(lent), actor, effect.id, scene.boosted, What.LENT))
    if ((side to effect.id) in onTheLine) return emptyList()
    val arrives = when (standIn) {
        is StandIn.Building -> rules.buildingArrives * standIn.level
        is StandIn.KeyFigure -> lent
    }
    return listOf(Change.OnTheLine(side, slice, effect.id, standIn, arrives, scene.boosted))
}
