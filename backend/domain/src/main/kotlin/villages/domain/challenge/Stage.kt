package villages.domain.challenge

import kotlin.math.max

/**
 * Who stands on stage, and what they have to work with: the slice each happening puts forward, the power a slice has
 * under the other side's auras, and what an effect's slot gives. See decision record 0105.
 */

/**
 * The slice [side] puts on stage as a happening begins: one whose aspect is among the happening's, else one whose
 * anti-aspect is, else one drawn from them all; ties drawn too. At a change, an effect of the slice already on stage
 * may keep it there, which Will of One's Own does once.
 */
internal fun Contest.choose(side: Side) {
    val slices = setup.side(side)
    val current = onStage[side]
    if (previous != null && current != null) {
        val keeping = effectsOf(side, current).firstOrNull { (effect, behaviour) -> behaviour.keepsStage(scene(side, current, effect)) }
        if (keeping != null) {
            drawn[side] = false
            say(What.ON_STAGE, side, Actor.OfSlice(side, current), keeping.first.id)
            return
        }
    }
    val own = slices.indices.filter { slices[it].aspect in happening.aspects }
    val anti = slices.indices.filter { slices[it].aspect.anti in happening.aspects }
    val chosen = rng.pick(own.ifEmpty { anti }.ifEmpty { slices.indices.toList() })
    onStage[side] = chosen
    drawn[side] = own.isEmpty() && anti.isEmpty()
    say(What.ON_STAGE, side, Actor.OfSlice(side, chosen))
}

/** The power of [side]'s slice [slice], lowered by the auras of the other side's slice on stage, and never below nothing. */
internal fun Contest.powerOf(side: Side, slice: Int): Double {
    val lowered = onStageEffects(side.other).sumOf { (effect, behaviour) -> behaviour.aura(scene(side.other, effect)) }
    return max(0.0, setup.side(side)[slice].power - lowered)
}

/** Says each aura that came on or went off since the last second: a passive that lowers the other side's power while it holds. */
internal fun Contest.sayAuras() {
    val now = Side.entries.flatMap { side ->
        onStageEffects(side).filter { (effect, behaviour) -> behaviour.aura(scene(side, effect)) > 0.0 }.map { (effect, _) -> side to effect.id }
    }.toSet()
    (now - auras).forEach { (side, id) ->
        val lowered = effectsOf(side, onStage.getValue(side)).first { it.first.id == id }.let { (effect, behaviour) -> behaviour.aura(scene(side, effect)) }
        say(What.AURA_ON, side, sliceActor(side), id, sliceActor(side.other), lowered)
    }
    (auras - now).forEach { (side, id) -> say(What.AURA_OFF, side, Actor.TheChallenge, id) }
    auras = now
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
