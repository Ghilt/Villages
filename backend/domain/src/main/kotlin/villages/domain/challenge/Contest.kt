package villages.domain.challenge

import kotlin.math.abs

/**
 * Fights a challenge out, at once, from its setup and a seed: a pure function of the setup, the seed, the catalogue
 * and the rules, so the same four always give the same moments and the same outcome. The luck is the seed's alone,
 * and choosing it is not done here. See decision record 0107.
 */
object Challenge {
    /** The version of these rules: a seed replays a challenge only on the version that fought it. */
    const val ENGINE = 2

    fun resolve(
        setup: ChallengeSetup,
        seed: Long,
        catalogue: ChallengeCatalogue,
        rules: ChallengeRules,
        effects: Map<String, EffectBehaviour> = ChallengeBehaviours.effects,
        summons: Map<String, SummonBehaviour> = ChallengeBehaviours.summons,
    ): ChallengeResult {
        val refused = setup.refusals(catalogue)
        require(refused.isEmpty()) { refused.joinToString("; ") }
        return Contest(setup, seed, catalogue, rules, effects, summons).fight()
    }
}

/**
 * One challenge being fought, second by second. Every second reads the state it began with and lands what it asked
 * for together at its end: first, when one is due, a happening begins - what changes away is said and coffers pour,
 * the slices whose aspect it has match it, and every slice meets it, its working triggers firing - and the tug is
 * looked at; then every summon acts and every working passive that works each second does, and the tug is looked at
 * again. Pulled to an end, it stops there. What works is whatever needs no matching aspect, and whatever does while
 * its aspect matches.
 */
internal class Contest(
    val setup: ChallengeSetup,
    private val seed: Long,
    val catalogue: ChallengeCatalogue,
    val rules: ChallengeRules,
    private val effects: Map<String, EffectBehaviour>,
    val summonBehaviours: Map<String, SummonBehaviour>,
) {
    val rng = Rng(seed)
    val integrity: Map<Side, DoubleArray> = Side.entries.associateWith { side -> setup.side(side).map { it.integrity }.toDoubleArray() }
    /** What each of each side's slices bears, its buffs' and debuffs' ids each with the last second it lasts. */
    val bearings: Map<Side, List<MutableMap<String, Int>>> = Side.entries.associateWith { side -> List(setup.side(side).size) { mutableMapOf<String, Int>() } }

    /** Whether each of each side's slices' aspects matches the latest happening, as its slices are numbered. */
    val matching: Map<Side, BooleanArray> = Side.entries.associateWith { side -> BooleanArray(setup.side(side).size) }
    val field = mutableListOf<Summon>()
    var serials = 0
    var tug = 0.0
    var second = 0
    var at = -1
    var previous: Happening? = null
    val moments = mutableListOf<ChallengeMoment>()
    val losses = mutableListOf<Loss>()

    /** Each side's effects whose slot's thing came on the line. */
    val onTheLine = mutableSetOf<Pair<Side, String>>()
    var aurasOn = emptySet<Pair<Side, String>>()
    private val asked = mutableSetOf<Triple<Side, Int, String>>()

    /** What works on each side, worked out once a happening, since only matching moves it; [match] forgets it. */
    val works = mutableMapOf<Side, List<Triple<Int, ChallengeEffect, EffectBehaviour>>>()

    /** The summons said to sit out a happening, by serial and happening, so each says it once a happening. */
    private val idle = mutableSetOf<Pair<Int, Int>>()
    private var ending: Ending? = null

    val happening: Happening get() = setup.progression.happenings[at]

    /** The last second of the happening going on: the one before the next begins, or the challenge's last. */
    fun happeningEnds(): Int {
        val progression = setup.progression
        return if (at + 1 < progression.happenings.size) progression.startOf(at + 1) - 1 else progression.seconds - 1
    }

    fun fight(): ChallengeResult {
        val progression = setup.progression
        for (now in 0 until progression.seconds) {
            second = now
            lift()
            val due = progression.happenings.indices.firstOrNull { progression.startOf(it) == now }
            if (due != null) {
                begin(due)
                if (pulledToAnEnd()) break
            }
            sayAuras()
            act()
            if (pulledToAnEnd()) break
        }
        if (ending == null) {
            land(field.filter { it.coffer > 0.0 }.map { Change.Pour(it.serial) })
            if (!pulledToAnEnd()) {
                ending = Ending.TIME_RAN_OUT
                say(What.ENDED, null, Actor.TheChallenge)
            }
        }
        return ChallengeResult(seed, moments.toList(), outcome())
    }

    private fun begin(index: Int) {
        previous = if (at >= 0) happening else null
        at = index
        say(What.HAPPENING_BEGAN, null, Actor.TheChallenge)
        val changes = mutableListOf<Change>()
        if (previous != null) {
            Side.entries.forEach { side -> changes += working(side).flatMap { (slice, effect, behaviour) -> behaviour.changed(scene(side, slice, effect)) } }
            changes += field.filter { it.coffer > 0.0 }.map { Change.Pour(it.serial) }
        }
        Side.entries.forEach { match(it) }
        empowerMatches()
        Side.entries.forEach { changes += meet(it) }
        land(changes)
    }

    /** What [side]'s slices ask for as they meet the happening: each working trigger, unless the other side cancels it, and each working passive's first word. */
    private fun meet(side: Side): List<Change> {
        val theirs = working(side.other)
        return working(side).flatMap { (slice, effect, behaviour) ->
            if (effect.fires == Fires.TRIGGER) {
                val cancelling = theirs.firstOrNull { (by, their, its) -> its.cancels(scene(side.other, by, their), effect) }
                if (cancelling != null) {
                    val (by, their, _) = cancelling
                    return@flatMap listOf(Change.Say(What.CANCELLED, side.other, Actor.OfSlice(side.other, by), their.id, Actor.OfSlice(side, slice), targetEffect = effect.id))
                }
            }
            val fired = firing(side, slice, effect, behaviour)
            if (effect.fires != Fires.TRIGGER || !rng.chance(echoChance(side, slice))) return@flatMap fired
            fired + Change.Say(What.ECHOED, side, Actor.OfSlice(side, slice), effect.id) + firing(side, slice, effect, behaviour)
        }
    }

    /** What [effect] of [side]'s slice [slice] asks for as it meets the happening, and, a trigger fired off its aspect, the penalty it pays. */
    private fun firing(side: Side, slice: Int, effect: ChallengeEffect, behaviour: EffectBehaviour): List<Change> {
        val asked = behaviour.activated(scene(side, slice, effect))
        if (effect.fires != Fires.TRIGGER || matching.getValue(side)[slice]) return asked
        val penalty = penaltyOf(side, slice)
        return if (penalty > 0.0) asked + Change.Pull(side, -penalty, Actor.OfSlice(side, slice), effect.id, false, What.PENALISED) else asked
    }

    private fun act() {
        val changes = mutableListOf<Change>()
        Side.entries.forEach { side -> changes += working(side).flatMap { (slice, effect, behaviour) -> behaviour.everySecond(scene(side, slice, effect)) } }
        field.toList().forEach { summon ->
            if (summon.arrived >= second || stunned(summon)) return@forEach
            if (sitsOut(summon)) {
                if (idle.add(summon.serial to at)) changes += Change.Say(What.IDLE, summon.side, summon.actor, null)
                return@forEach
            }
            val enemy = summon.side.other
            changes += actOf(summon)
            changes += wearOf(summon)
            if (rng.chance(againChance(summon))) {
                changes += Change.Say(What.ACTED_AGAIN, summon.side, summon.actor, null)
                changes += actOf(summon)
                changes += wearOf(summon)
            }
            changes += working(enemy).flatMap { (slice, effect, behaviour) -> behaviour.enemyActed(scene(enemy, slice, effect), summon) }
            changes += working(summon.side).flatMap { (slice, effect, behaviour) -> behaviour.friendActed(scene(summon.side, slice, effect), summon) }
        }
        land(changes)
    }

    private fun actOf(summon: Summon): List<Change> {
        val scene = summonScene(summon)
        if (summon.onTheLine) return listOf(Change.Pull(summon.side, pullOf(summon), summon.actor, summon.lineEffect, scene.boosted))
        return summonBehaviours.getValue(summon.kind).act(scene, summon)
    }

    fun pullOf(summon: Summon): Double {
        val scene = summonScene(summon)
        return if (summon.onTheLine) scene.boost(summon.arrivedWith * rules.pullShare) else summonBehaviours.getValue(summon.kind).pull(scene, summon)
    }

    private fun pulledToAnEnd(): Boolean {
        if (abs(tug) < rules.tugEnds) return false
        val end = if (tug > 0.0) rules.tugEnds else -rules.tugEnds
        val delta = end - tug
        tug = end
        ending = Ending.PULLED
        say(What.ENDED, if (end > 0.0) Side.A else Side.B, Actor.TheChallenge, tugDelta = delta)
        return true
    }

    private fun outcome(): Outcome {
        val wonBy = when {
            tug > 0.0 -> Side.A
            tug < 0.0 -> Side.B
            else -> null
        }
        val gains = Side.entries.flatMap { side ->
            setup.side(side).flatMapIndexed { slice, spec ->
                spec.effects.flatMap { id ->
                    effects.getValue(id).gains(scene(side, slice, catalogue.effect(id)!!), wonBy == side, (side to id) in onTheLine)
                }
            }
        }
        return Outcome(tug, ending!!, second, wonBy, gains, losses.toList())
    }

    /** [side]'s effects that work now, each with its slice and its behaviour: whatever needs nothing, and whatever needs a matching aspect or its anti-aspect while the happening has it. */
    fun working(side: Side): List<Triple<Int, ChallengeEffect, EffectBehaviour>> = works.getOrPut(side) {
        val matches = matching.getValue(side)
        setup.side(side).indices.flatMap { slice ->
            val anti = happening.matches(setup.side(side)[slice].aspect.anti)
            effectsOf(side, slice).filter { (effect, _) ->
                when (effect.needs) {
                    null -> true
                    Needs.MATCH -> matches[slice]
                    Needs.ANTI -> anti
                }
            }.map { (effect, behaviour) -> Triple(slice, effect, behaviour) }
        }
    }

    fun effectsOf(side: Side, slice: Int): List<Pair<ChallengeEffect, EffectBehaviour>> =
        setup.side(side)[slice].effects.map { id -> catalogue.effect(id)!! to effects.getValue(id) }

    fun cap(side: Side): Int = setup.side(side).sumOf { it.summonCount }

    fun say(
        what: What,
        side: Side?,
        actor: Actor,
        effect: String? = null,
        target: Actor? = null,
        amount: Double? = null,
        boosted: Boolean = false,
        tugDelta: Double = 0.0,
        targetEffect: String? = null,
        status: String? = null,
    ) {
        moments += ChallengeMoment(second, at, side, actor, what, effect, target, amount, boosted, tugDelta, tug, targetEffect, status)
    }

    fun scene(side: Side, slice: Int, effect: ChallengeEffect): Scene =
        SceneOf(side, slice, effect.aspect, effect::number, Actor.OfSlice(side, slice), effect, effect.puts, null)

    fun summonScene(summon: Summon): Scene =
        SceneOf(summon.side, summon.owner, summon.aspect, { catalogue.summons.getValue(summon.kind).number(it) }, summon.actor, null, catalogue.summons[summon.kind]?.puts, summon)

    private inner class SceneOf(
        override val side: Side,
        override val slice: Int,
        private val aspect: Aspect,
        private val numbers: (String) -> Double,
        override val actor: Actor,
        private val entry: ChallengeEffect?,
        private val puts: String?,
        private val summon: Summon?,
    ) : Scene {
        override val second: Int get() = this@Contest.second
        override val happening: Happening get() = this@Contest.happening
        override val previous: Happening? get() = this@Contest.previous
        override val matches: Boolean get() = if (entry != null) matching.getValue(side)[slice] else happening.matches(aspect)
        override val boosted: Boolean get() = empowerment(bearing) > 1.0
        override val effect: String? get() = entry?.id

        override fun number(name: String): Double = numbers(name)

        override fun boost(amount: Double): Double = amount * empowerment(bearing) * effectiveness(bearing)

        /** What this scene's own bearer bears: the summon's, or its slice's. */
        private val bearing: Map<String, Int>
            get() = summon?.bearing ?: bearings.getValue(side)[slice]

        override fun chance(percent: Double): Boolean = rng.chance(percent)

        override fun <T> pick(things: List<T>): T = rng.pick(things)

        override fun ownPower(slice: Int): Double = powerOf(side, slice)

        override fun integrity(side: Side): Double = this@Contest.integrity.getValue(side).average()

        override fun favours(side: Side): Boolean = if (side == Side.A) tug > 0.0 else tug < 0.0

        override fun summons(side: Side): List<Summon> = field.filter { it.side == side }

        override fun slices(side: Side): List<Actor> = setup.side(side).indices.map { Actor.OfSlice(side, it) }

        override fun once(): Boolean = asked.add(Triple(side, slice, entry?.id ?: ""))

        override fun slotFires(): List<Change> = slotOf(side, slice, entry ?: error("only an effect has a slot"))

        override fun hire(): List<Change> {
            val effect = entry ?: error("only an effect hires")
            return listOf(Change.Hire(side, slice, effect.summons ?: error("${effect.id} names no summon"), effect.id))
        }

        override fun pullOf(summon: Summon): Double = this@Contest.pullOf(summon)

        override fun putOn(target: Actor, seconds: Double): Change =
            Change.PutOn(side, target, puts ?: error("${effect ?: actor} puts nothing on"), second + boost(seconds).toInt(), actor, effect)
    }
}
