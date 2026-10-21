package villages.domain.challenge

/** The six effects of the Authority-Freedom pair, the Enforcer and the Rebel. See `docs/plans/challenges.md`. */

/** Against the Grain: `amount` at each happening its slice's aspect does not match, which is the only time it fires. */
private object AgainstTheGrain : EffectBehaviour {
    override val reads = setOf("amount")

    override fun activated(scene: Scene): List<Change> =
        if (!scene.matches) listOf(Change.Pull(scene.side, scene.boost(scene.number("amount")), scene.actor, scene.effect, scene.boosted)) else emptyList()
}

/**
 * Will of One's Own: once in a challenge, at a change to a happening its slice's aspect does not match, the slice
 * goes on matching anyway, for that happening, though without the boost, which the happening alone gives.
 */
private object OwnWill : EffectBehaviour {
    override fun keepsMatching(scene: Scene): Boolean = scene.once()
}

/**
 * The Enforcer: each act costs its side `costs`, never boosted, and puts the debuff its entry names, stunned, on the
 * enemy summon pulling hardest for `stuns` seconds, boosted and cut to whole seconds; put on again, it lasts from then.
 */
private object Enforcer : SummonBehaviour {
    override val reads = setOf("costs", "stuns")

    override fun pull(scene: Scene, summon: Summon): Double = -scene.number("costs")

    override fun act(scene: Scene, summon: Summon): List<Change> {
        val cost = Change.Pull(summon.side, -scene.number("costs"), summon.actor, null, false, What.COST)
        val enemies = scene.summons(summon.side.other)
        if (enemies.isEmpty()) return listOf(cost)
        val hardest = enemies.maxOf { scene.pullOf(it) }
        val target = scene.pick(enemies.filter { scene.pullOf(it) == hardest })
        return listOf(cost, scene.putOn(target.actor, scene.number("stuns")))
    }
}

internal val authorityAndFreedom: Map<String, EffectBehaviour> = mapOf(
    "authority.watch" to Hires,
    "authority.curfew" to Afflicts(Own.SUMMONS),
    "authority.fealty" to Rallies(Own.SUMMONS),
    "authority.firmHand" to Afflicts(Own.SLICES),
    "freedom.commons" to Hires,
    "freedom.againstTheGrain" to AgainstTheGrain,
    "freedom.ownWill" to OwnWill,
    "freedom.wordSpreads" to Rallies(Own.SLICES),
)

internal val authorityAndFreedomSummons: Map<String, SummonBehaviour> = mapOf("enforcer" to Enforcer, "rebel" to PullsHarderBehind)
