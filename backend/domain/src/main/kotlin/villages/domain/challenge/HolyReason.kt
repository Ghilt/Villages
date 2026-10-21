package villages.domain.challenge

import villages.domain.Resource
import kotlin.math.max

/** The six effects of the Holy-Reason pair, and the Priest. See `docs/plans/challenges.md`. */

/** Divine Rebuke: each time an enemy summon acts, a `chance` that every slice its side brought loses `integrity`. */
private object Rebuke : EffectBehaviour {
    override val reads = setOf("chance", "integrity")

    override fun enemyActed(scene: Scene, summon: Summon): List<Change> {
        if (!scene.chance(scene.number("chance"))) return emptyList()
        return listOf(Change.Wear(summon.side, scene.boost(scene.number("integrity")), scene.actor, scene.effect!!, scene.boosted))
    }
}

/** Sanctuary: the building in its slot comes on the line the first time its slice comes on stage; `piety` if won. */
private object Sanctuary : EffectBehaviour {
    override val reads = setOf("piety")

    override fun activated(scene: Scene): List<Change> = if (scene.once()) scene.slotFires() else emptyList()

    override fun gains(scene: Scene, won: Boolean, onTheLine: Boolean): List<Gain> =
        if (won && onTheLine) listOf(Gain(scene.side, Resource.PIETY, scene.number("piety"), scene.effect!!)) else emptyList()
}

/** Refutation: a `chance` to cancel each enemy trigger. */
private object Refutation : EffectBehaviour {
    override val reads = setOf("chance")

    override fun cancels(scene: Scene, trigger: ChallengeEffect): Boolean = scene.chance(scene.number("chance"))
}

/** Seen Through: an enemy summon acts, and a `chance` it is seen through, and weakened, the debuff its entry names, for `seconds`. */
private object SeenThrough : EffectBehaviour {
    override val reads = setOf("chance", "seconds")

    override fun enemyActed(scene: Scene, summon: Summon): List<Change> {
        if (!scene.chance(scene.number("chance"))) return emptyList()
        return listOf(scene.putOn(summon.actor, scene.number("seconds")))
    }
}

/** The Priest: pulls `share` of the integrity its side's slice on stage has above the enemy's, never less than nothing. */
private object Priest : SummonBehaviour {
    override val reads = setOf("share")

    override fun pull(scene: Scene, summon: Summon): Double =
        scene.boost(scene.number("share") * max(0.0, scene.integrity(summon.side) - scene.integrity(summon.side.other)))

    override fun act(scene: Scene, summon: Summon): List<Change> =
        listOf(Change.Pull(summon.side, pull(scene, summon), summon.actor, null, scene.boosted))
}

internal val holyAndReason: Map<String, EffectBehaviour> = mapOf(
    "holy.rebuke" to Rebuke,
    "holy.ordination" to Hires,
    "holy.sanctuary" to Sanctuary,
    "reason.counsel" to Slotted,
    "reason.refutation" to Refutation,
    "reason.seenThrough" to SeenThrough,
    "reason.foresight" to Rallies(Own.BOTH),
    "holy.miracle" to Rallies(Own.SLICES, pulls = true),
    "reason.doubt" to Afflicts(Own.SUMMONS, pulls = true),
)

internal val holyAndReasonSummons: Map<String, SummonBehaviour> = mapOf("priest" to Priest)
