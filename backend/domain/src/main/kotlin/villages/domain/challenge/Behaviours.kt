package villages.domain.challenge

/**
 * What an effect does, in code, keyed by its id in the catalogue, which gives it its numbers. Every hook does nothing
 * unless the effect says otherwise, and every hook but [gains] is asked only while the effect's slice is on stage,
 * because a passive works only there. A hook never changes the contest: it says what it asks for as [Change]s, which
 * land together at the end of the moment, so everything in one second reads the state the second began with.
 */
interface EffectBehaviour {
    /** The numbers it reads from its catalogue entry, which the catalogue must give it. */
    val reads: Set<String> get() = emptySet()

    /** Its slice came on stage at a happening: [Scene.byDraw] when by the draw rather than by an aspect. */
    fun activated(scene: Scene): List<Change> = emptyList()

    /** The happening is changing, before the new one chooses its slices: [Scene.previous] to [Scene.happening]. */
    fun changed(scene: Scene): List<Change> = emptyList()

    fun everySecond(scene: Scene): List<Change> = emptyList()

    /** An enemy summon is about to act: true stops it. */
    fun stops(scene: Scene, summon: Summon): Boolean = false

    fun enemyActed(scene: Scene, summon: Summon): List<Change> = emptyList()

    fun friendActed(scene: Scene, summon: Summon): List<Change> = emptyList()

    /** An enemy trigger is about to fire: true cancels it. */
    fun cancels(scene: Scene, trigger: ChallengeEffect): Boolean = false

    /** A summon was killed, its [friend] or an enemy's. */
    fun killed(scene: Scene, summon: Summon, friend: Boolean): List<Change> = emptyList()

    /** How much lower the opponent's power is right now; nothing when it does not hold. */
    fun aura(scene: Scene): Double = 0.0

    /** At a change of happening, whether its slice stays on stage whatever the new aspects. */
    fun keepsStage(scene: Scene): Boolean = false

    /** What its side gains when the challenge ends, [won] or not; [onTheLine] when its slot's thing went on the line. */
    fun gains(scene: Scene, won: Boolean, onTheLine: Boolean): List<Gain> = emptyList()
}

/** What a summon does when it acts, keyed by its id in the catalogue, which gives it its numbers. */
interface SummonBehaviour {
    val reads: Set<String> get() = emptySet()

    fun act(scene: Scene, summon: Summon): List<Change>

    /** How much it pulls an act, boost and all: what "the summon pulling hardest" is judged by. */
    fun pull(scene: Scene, summon: Summon): Double
}

/**
 * What a behaviour sees from its own [side] at one moment, and asks of the contest's luck. The numbers are its own
 * entry's; the boost is judged by its own aspect - an effect's slice's, a summon's - against the happening of the
 * moment.
 */
interface Scene {
    val second: Int
    val side: Side

    /** Its slice's place on its side: the effect's, or the summon's owner. */
    val slice: Int
    val happening: Happening

    /** The happening before this one, at a change; none at the first. */
    val previous: Happening?

    /** Its slice came on stage by the draw, matching neither the happening's aspects nor their anti-aspects. */
    val byDraw: Boolean
    val boosted: Boolean

    fun number(name: String): Double

    /** [amount] grown by the aspect boost when it holds. */
    fun boost(amount: Double): Double

    fun chance(percent: Double): Boolean

    fun <T> pick(things: List<T>): T

    /** The power of [side]'s slice on stage, lowered by any aura of the other side's. */
    fun power(side: Side): Double

    /** The power of one of this side's own slices, lowered by any aura against it: a summon's owner's. */
    fun ownPower(slice: Int): Double

    fun integrity(side: Side): Double

    /** Whether the tug strictly favours [side]. */
    fun favours(side: Side): Boolean

    fun summons(side: Side): List<Summon>

    /** The first time this is asked for this effect on this side in the challenge: true; after, false. */
    fun once(): Boolean

    /** This effect's slot asked for: a key figure lends, a thing on the line comes on it. */
    fun slotFires(): List<Change>

    /** This effect's summon hired, the one its catalogue entry names. */
    fun hire(): List<Change>

    /** How much [summon] pulls an act, boost and all. */
    fun pullOf(summon: Summon): Double

    /** Who this is, as a moment names the doer: its slice, or the summon. */
    val actor: Actor

    /** The effect this is the scene of, by its id; none for a summon's. */
    val effect: String?
}

/** A summon on the field: its [kind], its aspect, its fixed [integrity], and whose it is now. */
class Summon internal constructor(
    val serial: Int,
    val kind: String,
    val aspect: Aspect,
    side: Side,
    owner: Int,
    val integrity: Double,
    val arrived: Int,
    /** A building or a person put on the line, and the effect whose slot put it there; none for a summon proper. */
    val line: StandIn? = null,
    val lineEffect: String? = null,
    /** What a thing on the line arrived paying, which its pull is a share of. */
    val arrivedWith: Double = 0.0,
) {
    var side: Side = side
        internal set
    var owner: Int = owner
        internal set
    var silencedUntil: Int = -1
        internal set
    var coffer: Double = 0.0
        internal set

    val onTheLine: Boolean get() = line != null

    val actor: Actor get() = Actor.OfSummon(serial, kind, line?.name)
}

/** What a behaviour asks of the contest, landing at the end of its moment. */
sealed interface Change {
    /** The tug moved toward [toward] by [amount]; a negative one moves it the other way, as a cost does. */
    data class Pull(val toward: Side, val amount: Double, val actor: Actor, val effect: String?, val boosted: Boolean, val what: What = What.PULLED) : Change

    data class Hire(val side: Side, val owner: Int, val kind: String, val effect: String) : Change

    data class Kill(val target: Int, val actor: Actor, val effect: String?) : Change

    data class Turn(val target: Int, val toward: Side, val owner: Int, val actor: Actor, val effect: String) : Change

    data class Silence(val target: Int, val until: Int, val actor: Actor, val effect: String?) : Change

    /** Every slice of [side] loses [amount] of integrity. */
    data class Wear(val side: Side, val amount: Double, val actor: Actor, val effect: String, val boosted: Boolean) : Change

    data class Deposit(val target: Int, val amount: Double, val boosted: Boolean) : Change

    data class Pour(val target: Int) : Change

    /** A building or a person comes on the line for [side], bringing [arrives] before any boost, and [boosted] or not. */
    data class OnTheLine(val side: Side, val owner: Int, val effect: String, val standIn: StandIn, val arrives: Double, val boosted: Boolean) : Change

    /** A moment that changes nothing but is worth saying. */
    data class Say(
        val what: What,
        val side: Side?,
        val actor: Actor,
        val effect: String?,
        val target: Actor? = null,
        val amount: Double? = null,
        val targetEffect: String? = null,
    ) : Change
}

/** An effect whose behaviour is not built yet: it says so whenever its slice comes on stage, and does nothing else. */
object Unbuilt : EffectBehaviour {
    override fun activated(scene: Scene): List<Change> = listOf(Change.Say(What.NOT_BUILT, scene.side, scene.actor, scene.effect))
}

/**
 * Every effect's and summon's behaviour, by its id. The catalogue and the code are held to each other: every effect in
 * the catalogue has a behaviour here, built or [Unbuilt], with the numbers it reads; every summon a built effect brings
 * has its own; and every behaviour here has its entry in the real catalogue, which `ChallengeBehavioursSpec` holds.
 */
object ChallengeBehaviours {
    /** The effects of the plan's later steps, each built in its own. */
    private val UNBUILT = listOf(
        "authority.watch", "authority.decree", "authority.firmHand",
        "freedom.commons", "freedom.againstTheGrain", "freedom.ownWill",
        "greed.countingHouse", "greed.farmTaxes", "greed.pickBones",
        "generosity.patron", "generosity.alms", "generosity.remembered",
        "nature.wildHunt", "nature.teeming", "nature.wildRemembers",
        "industry.engines", "industry.works", "industry.wellOiled",
    )

    val effects: Map<String, EffectBehaviour> = violenceAndDiplomacy + holyAndReason + UNBUILT.associateWith { Unbuilt }

    val summons: Map<String, SummonBehaviour> = violenceAndDiplomacySummons + holyAndReasonSummons

    /** What [catalogue] asks of the code that the code lacks, a line a lack; none when the code has all of it. */
    fun unmatched(catalogue: ChallengeCatalogue): List<String> = buildList {
        catalogue.effects.forEach { effect ->
            val behaviour = effects[effect.id]
            if (behaviour == null) {
                add("${effect.id} has no behaviour in the code")
                return@forEach
            }
            (behaviour.reads - effect.numbers.keys).forEach { add("${effect.id} gives no number '$it', which its behaviour reads") }
            val summon = effect.summons
            if (summon != null && behaviour !== Unbuilt) {
                val spec = catalogue.summons.getValue(summon)
                val acts = summons[summon]
                if (acts == null) add("$summon has no behaviour in the code") else (acts.reads - spec.numbers.keys).forEach { add("$summon gives no number '$it', which its behaviour reads") }
            }
        }
    }
}
