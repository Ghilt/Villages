package villages.domain.challenge

import villages.domain.Resource

/** The six effects of the Greed-Generosity pair, the Collector and the Benefactor. See `docs/plans/challenges.md`. */

/** Counting House: the building in its slot comes on the line as its slice comes on stage; `wealth` if won. */
private object CountingHouse : EffectBehaviour {
    override val reads = setOf("wealth")

    override fun activated(scene: Scene): List<Change> = scene.slotFires()

    override fun gains(scene: Scene, won: Boolean, onTheLine: Boolean): List<Gain> =
        if (won && onTheLine) listOf(Gain(scene.side, Resource.WEALTH, scene.number("wealth"), scene.effect!!)) else emptyList()
}

/** Pulls its `amount` whenever a summon is killed: an enemy's, or, [friendly], one of its own side's. */
private class OnAKilling(private val friendly: Boolean) : EffectBehaviour {
    override val reads = setOf("amount")

    override fun killed(scene: Scene, summon: Summon, friend: Boolean): List<Change> =
        if (friend == friendly) listOf(Change.Pull(scene.side, scene.boost(scene.number("amount")), scene.actor, scene.effect, scene.boosted)) else emptyList()
}

/**
 * The Collector: each act costs its side `costs`, never boosted, and puts `deposits`, boosted, in its coffer, which
 * the contest pours into the tug at the next change of happening or at the end, and which is lost with the Collector.
 */
private object Collector : SummonBehaviour {
    override val reads = setOf("costs", "deposits")

    override fun pull(scene: Scene, summon: Summon): Double = -scene.number("costs")

    override fun act(scene: Scene, summon: Summon): List<Change> = listOf(
        Change.Pull(summon.side, -scene.number("costs"), summon.actor, null, false, What.COST),
        Change.Deposit(summon.serial, scene.boost(scene.number("deposits")), scene.boosted),
    )
}

internal val greedAndGenerosity: Map<String, EffectBehaviour> = mapOf(
    "greed.countingHouse" to CountingHouse,
    "greed.farmTaxes" to Hires,
    "greed.pickBones" to OnAKilling(friendly = false),
    "generosity.patron" to Slotted,
    "generosity.alms" to Hires,
    "generosity.remembered" to OnAKilling(friendly = true),
)

internal val greedAndGenerositySummons: Map<String, SummonBehaviour> = mapOf("collector" to Collector, "benefactor" to PullsHarderBehind)
