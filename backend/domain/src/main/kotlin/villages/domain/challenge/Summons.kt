package villages.domain.challenge

import kotlin.math.max

/**
 * How what a moment asked for lands, in three passes: first the tug and the coffers move, as everything acted on the
 * state the moment began with; then the dead fall, so a summon both killed and turned is killed, and the room a death
 * leaves is there for what comes next; then summons turn and come, things come on the line, slices are worn and
 * summons silenced. Each change is said as it lands, a moment each. The rules that must hold are held here: no side
 * ever has more summons than its slices let it have, and a thing on the line comes on it once. See decision record 0107.
 */
internal fun Contest.land(changes: List<Change>) {
    val (moving, rest) = changes.partition { it is Change.Pull || it is Change.Say || it is Change.Deposit || it is Change.Pour }
    moving.forEach { landOne(it) }
    rest.filterIsInstance<Change.Kill>().forEach { landOne(it) }
    rest.filterNot { it is Change.Kill }.forEach { landOne(it) }
}

private fun Contest.landOne(change: Change) {
    when (change) {
        is Change.Pull -> pull(change)
        is Change.Hire -> hire(change)
        is Change.Kill -> kill(change)
        is Change.Turn -> turn(change)
        is Change.OnTheLine -> comeOnTheLine(change)
        is Change.Silence -> alive(change.target)?.let {
            it.silencedUntil = max(it.silencedUntil, change.until)
            say(What.SILENCED, it.side.other, change.actor, change.effect, it.actor, (change.until - second).toDouble())
        }
        is Change.Wear -> {
            val worn = integrity.getValue(change.side)
            worn.indices.forEach { worn[it] = max(0.0, worn[it] - change.amount) }
            say(What.INTEGRITY_LOST, change.side.other, change.actor, change.effect, amount = change.amount, boosted = change.boosted)
        }
        is Change.Deposit -> alive(change.target)?.let {
            it.coffer += change.amount
            say(What.BANKED, it.side, it.actor, amount = change.amount, boosted = change.boosted)
        }
        is Change.Pour -> alive(change.target)?.takeIf { it.coffer > 0.0 }?.let {
            val poured = it.coffer
            it.coffer = 0.0
            pull(Change.Pull(it.side, poured, it.actor, null, false, What.POURED))
        }
        is Change.Say -> say(change.what, change.side, change.actor, change.effect, change.target, change.amount, targetEffect = change.targetEffect)
    }
}

private fun Contest.alive(serial: Int): Summon? = field.firstOrNull { it.serial == serial }

/** How many summons proper [side] has: a thing on the line is not counted against its slices' summon counts. */
private fun Contest.counted(side: Side): Int = field.count { it.side == side && !it.onTheLine }

private fun Contest.pull(change: Change.Pull) {
    val moved = if (change.toward == Side.A) change.amount else -change.amount
    tug += moved
    say(change.what, change.toward, change.actor, change.effect, amount = change.amount, boosted = change.boosted, tugDelta = moved)
}

private fun Contest.hire(change: Change.Hire) {
    val actor = Actor.OfSlice(change.side, change.owner)
    if (counted(change.side) >= cap(change.side)) {
        say(What.NO_ROOM, change.side, actor, change.effect)
        return
    }
    val spec = catalogue.summons.getValue(change.kind)
    val summon = Summon(++serials, change.kind, spec.aspect, change.side, change.owner, integrity.getValue(change.side)[change.owner], second)
    field += summon
    check(counted(change.side) <= cap(change.side)) { "side ${change.side} has more summons than its slices let it have" }
    say(What.SUMMONED, change.side, actor, change.effect, summon.actor)
}

private fun Contest.kill(change: Change.Kill) {
    val target = alive(change.target) ?: return
    field.remove(target)
    say(What.KILLED, target.side.other, change.actor, change.effect, target.actor)
    if (target.coffer > 0.0) say(What.COFFER_LOST, target.side, target.actor, amount = target.coffer)
    target.line?.let { line ->
        val fits = if (line is StandIn.Building) Fits.STRUCTURE else Fits.KEY_FIGURE
        losses += Loss(target.side, line.name, fits, rules.effectivenessLost, target.lineEffect!!)
    }
    Side.entries.forEach { side ->
        onStageEffects(side).flatMap { (effect, behaviour) -> behaviour.killed(scene(side, effect), target, friend = target.side == side) }
            .forEach { landOne(it) }
    }
}

private fun Contest.turn(change: Change.Turn) {
    val target = alive(change.target) ?: return
    if (target.onTheLine || target.side == change.toward) return
    if (counted(change.toward) >= cap(change.toward)) {
        field.remove(target)
        say(What.DESERTED, change.toward, change.actor, change.effect, target.actor)
        if (target.coffer > 0.0) say(What.COFFER_LOST, target.side, target.actor, amount = target.coffer)
        return
    }
    target.side = change.toward
    target.owner = change.owner
    say(What.TURNED, change.toward, change.actor, change.effect, target.actor)
}

private fun Contest.comeOnTheLine(change: Change.OnTheLine) {
    if (!onTheLine.add(change.side to change.effect)) return
    val aspect = setup.side(change.side)[change.owner].aspect
    val summon = Summon(
        serial = ++serials,
        kind = Actor.ON_THE_LINE,
        aspect = aspect,
        side = change.side,
        owner = change.owner,
        integrity = integrity.getValue(change.side)[change.owner] + change.arrives * rules.integrityShare,
        arrived = second,
        line = change.standIn,
        lineEffect = change.effect,
        arrivedWith = change.arrives,
    )
    field += summon
    val paid = if (change.boosted) change.arrives * rules.boost else change.arrives
    pull(Change.Pull(change.side, paid, summon.actor, change.effect, change.boosted, What.ARRIVED))
}
