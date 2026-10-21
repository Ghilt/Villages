package villages.domain.challenge

/** The six effects of the Authority-Freedom pair, the Enforcer and the Rebel. See `docs/plans/challenges.md`. */

/** By Decree: a `chance` to stop each act of an enemy summon whose integrity its slice's power beats. */
private object Decree : EffectBehaviour {
    override val reads = setOf("chance")

    override fun stops(scene: Scene, summon: Summon): Boolean =
        scene.ownPower(scene.slice) > summon.integrity && scene.chance(scene.number("chance"))
}

/** The Firm Hand: while the tug favours its side, the opponent's power is `power` lower. */
private object FirmHand : EffectBehaviour {
    override val reads = setOf("power")

    override fun aura(scene: Scene): Double = if (scene.favours(scene.side)) scene.boost(scene.number("power")) else 0.0
}

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
 * The Enforcer: each act costs its side `costs`, never boosted, and silences the enemy summon pulling hardest for
 * `silences` seconds, boosted and cut to whole seconds; a silence refreshes, never stacks.
 */
private object Enforcer : SummonBehaviour {
    override val reads = setOf("costs", "silences")

    override fun pull(scene: Scene, summon: Summon): Double = -scene.number("costs")

    override fun act(scene: Scene, summon: Summon): List<Change> {
        val cost = Change.Pull(summon.side, -scene.number("costs"), summon.actor, null, false, What.COST)
        val enemies = scene.summons(summon.side.other)
        if (enemies.isEmpty()) return listOf(cost)
        val hardest = enemies.maxOf { scene.pullOf(it) }
        val target = scene.pick(enemies.filter { scene.pullOf(it) == hardest })
        return listOf(cost, Change.Silence(target.serial, scene.second + scene.boost(scene.number("silences")).toInt(), summon.actor, null))
    }
}

internal val authorityAndFreedom: Map<String, EffectBehaviour> = mapOf(
    "authority.watch" to Hires,
    "authority.decree" to Decree,
    "authority.firmHand" to FirmHand,
    "freedom.commons" to Hires,
    "freedom.againstTheGrain" to AgainstTheGrain,
    "freedom.ownWill" to OwnWill,
)

internal val authorityAndFreedomSummons: Map<String, SummonBehaviour> = mapOf("enforcer" to Enforcer, "rebel" to PullsHarderBehind)
