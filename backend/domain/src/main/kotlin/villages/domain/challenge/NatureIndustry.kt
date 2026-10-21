package villages.domain.challenge

/** The six effects of the Nature-Industry pair, the Predator, the Creature and the Machine. See `docs/plans/challenges.md`. */

/** Teeming Wilds: each time an enemy summon acts, a `chance` that the summon its entry names - a Creature - comes to its side. */
private object Teeming : EffectBehaviour {
    override val reads = setOf("chance")

    override fun enemyActed(scene: Scene, summon: Summon): List<Change> = if (scene.chance(scene.number("chance"))) scene.hire() else emptyList()
}

/** Well-Oiled: each time a summon of its side acts, a `chance` it is hastened, the buff its entry names, for `seconds`. */
private object WellOiled : EffectBehaviour {
    override val reads = setOf("chance", "seconds")

    override fun friendActed(scene: Scene, summon: Summon): List<Change> {
        if (!scene.chance(scene.number("chance"))) return emptyList()
        return listOf(scene.putOn(summon.actor, scene.number("seconds")))
    }
}

/**
 * The Predator: each act it pulls `pulls`, or, when an enemy summon's integrity is below its owner's power, with a
 * `kills` chance it kills one of those instead.
 */
private object Predator : SummonBehaviour {
    override val reads = setOf("pulls", "kills")

    override fun pull(scene: Scene, summon: Summon): Double = scene.boost(scene.number("pulls"))

    override fun act(scene: Scene, summon: Summon): List<Change> {
        val beatable = scene.beatable(scene.ownPower(summon.owner))
        if (beatable.isNotEmpty() && scene.chance(scene.number("kills"))) return listOf(Change.Kill(scene.pick(beatable).serial, summon.actor, null))
        return listOf(Change.Pull(summon.side, pull(scene, summon), summon.actor, null, scene.boosted))
    }
}

internal val natureAndIndustry: Map<String, EffectBehaviour> = mapOf(
    "nature.wildHunt" to Hires,
    "nature.teeming" to Teeming,
    "nature.overgrowth" to Afflicts(Own.SUMMONS),
    "nature.dread" to Afflicts(Own.SLICES),
    "industry.engines" to Hires,
    "industry.works" to Slotted,
    "industry.wellOiled" to WellOiled,
    "industry.clearLand" to Afflicts(Own.SUMMONS, pulls = true),
)

internal val natureAndIndustrySummons: Map<String, SummonBehaviour> = mapOf("predator" to Predator, "creature" to Pulls, "machine" to Pulls)
