package villages.domain.challenge

import kotlin.math.abs

/**
 * Fights a challenge out, at once, from its setup and a seed: a pure function of the setup, the seed, the catalogue
 * and the rules, so the same four always give the same moments and the same outcome. The luck is the seed's alone,
 * and choosing it is not done here. See decision record 0105.
 */
object Challenge {
    /** The version of these rules: a seed replays a challenge only on the version that fought it. */
    const val ENGINE = 1

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
 * each side chooses its slice, and the slices' triggers fire - and the tug is looked at; then every summon acts and
 * every passive that works each second does, and the tug is looked at again. Pulled to an end, it stops there.
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
    val onStage = mutableMapOf<Side, Int>()
    val drawn = mutableMapOf<Side, Boolean>()
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
    var auras = emptySet<Pair<Side, String>>()
    private val asked = mutableSetOf<Triple<Side, Int, String>>()
    private var ending: Ending? = null

    val happening: Happening get() = setup.progression.happenings[at]

    fun fight(): ChallengeResult {
        val progression = setup.progression
        for (now in 0 until progression.seconds) {
            second = now
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
            Side.entries.forEach { side -> changes += onStageEffects(side).flatMap { (effect, behaviour) -> behaviour.changed(scene(side, effect)) } }
            changes += field.filter { it.coffer > 0.0 }.map { Change.Pour(it.serial) }
        }
        Side.entries.forEach { choose(it) }
        Side.entries.forEach { changes += activate(it) }
        land(changes)
    }

    /** What [side]'s slice on stage asks for as it comes on: its triggers, unless the other side cancels one, and its passives' first word. */
    private fun activate(side: Side): List<Change> = onStageEffects(side).flatMap { (effect, behaviour) ->
        if (effect.fires == Fires.TRIGGER) {
            val cancelling = onStageEffects(side.other).firstOrNull { (theirs, its) -> its.cancels(scene(side.other, theirs), effect) }
            if (cancelling != null) {
                return@flatMap listOf(Change.Say(What.CANCELLED, side.other, sliceActor(side.other), cancelling.first.id, sliceActor(side), targetEffect = effect.id))
            }
        }
        behaviour.activated(scene(side, effect))
    }

    private fun act() {
        val changes = mutableListOf<Change>()
        Side.entries.forEach { side -> changes += onStageEffects(side).flatMap { (effect, behaviour) -> behaviour.everySecond(scene(side, effect)) } }
        field.toList().forEach { summon ->
            if (summon.arrived >= second || summon.silencedUntil >= second) return@forEach
            val enemy = summon.side.other
            val stopping = onStageEffects(enemy).firstOrNull { (effect, behaviour) -> behaviour.stops(scene(enemy, effect), summon) }
            if (stopping != null) {
                changes += Change.Say(What.STOPPED, enemy, sliceActor(enemy), stopping.first.id, summon.actor)
                return@forEach
            }
            changes += actOf(summon)
            changes += onStageEffects(enemy).flatMap { (effect, behaviour) -> behaviour.enemyActed(scene(enemy, effect), summon) }
            changes += onStageEffects(summon.side).flatMap { (effect, behaviour) -> behaviour.friendActed(scene(summon.side, effect), summon) }
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

    /** The effects of [side]'s slice on stage, each with its behaviour. */
    fun onStageEffects(side: Side): List<Pair<ChallengeEffect, EffectBehaviour>> = effectsOf(side, onStage.getValue(side))

    fun effectsOf(side: Side, slice: Int): List<Pair<ChallengeEffect, EffectBehaviour>> =
        setup.side(side)[slice].effects.map { id -> catalogue.effect(id)!! to effects.getValue(id) }

    fun sliceActor(side: Side): Actor = Actor.OfSlice(side, onStage.getValue(side))

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
    ) {
        moments += ChallengeMoment(second, at, side, actor, what, effect, target, amount, boosted, tugDelta, tug, targetEffect)
    }

    fun scene(side: Side, effect: ChallengeEffect): Scene = scene(side, onStage.getValue(side), effect)

    fun scene(side: Side, slice: Int, effect: ChallengeEffect): Scene =
        SceneOf(side, slice, effect.aspect, effect::number, Actor.OfSlice(side, slice), effect)

    fun summonScene(summon: Summon): Scene =
        SceneOf(summon.side, summon.owner, summon.aspect, { catalogue.summons.getValue(summon.kind).number(it) }, summon.actor, null)

    private inner class SceneOf(
        override val side: Side,
        override val slice: Int,
        private val aspect: Aspect,
        private val numbers: (String) -> Double,
        override val actor: Actor,
        private val entry: ChallengeEffect?,
    ) : Scene {
        override val second: Int get() = this@Contest.second
        override val happening: Happening get() = this@Contest.happening
        override val previous: Happening? get() = this@Contest.previous
        override val byDraw: Boolean get() = drawn[side] == true
        override val boosted: Boolean get() = happening.boosts(aspect)
        override val effect: String? get() = entry?.id

        override fun number(name: String): Double = numbers(name)

        override fun boost(amount: Double): Double = if (boosted) amount * rules.boost else amount

        override fun chance(percent: Double): Boolean = rng.chance(percent)

        override fun <T> pick(things: List<T>): T = rng.pick(things)

        override fun power(side: Side): Double = powerOf(side, onStage.getValue(side))

        override fun ownPower(slice: Int): Double = powerOf(side, slice)

        override fun integrity(side: Side): Double = this@Contest.integrity.getValue(side)[onStage.getValue(side)]

        override fun favours(side: Side): Boolean = if (side == Side.A) tug > 0.0 else tug < 0.0

        override fun summons(side: Side): List<Summon> = field.filter { it.side == side }

        override fun once(): Boolean = asked.add(Triple(side, slice, entry?.id ?: ""))

        override fun slotFires(): List<Change> = slotOf(side, slice, entry ?: error("only an effect has a slot"))

        override fun hire(): List<Change> {
            val effect = entry ?: error("only an effect hires")
            return listOf(Change.Hire(side, slice, effect.summons ?: error("${effect.id} names no summon"), effect.id))
        }

        override fun pullOf(summon: Summon): Double = this@Contest.pullOf(summon)
    }
}
