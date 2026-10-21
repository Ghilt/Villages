package villages.domain.challenge

/** The six effects of the Violence-Diplomacy pair, and the Mercenary. See `docs/plans/challenges.md`. */

/** No Quarter: each Mercenary act of its side has a `chance` to kill an enemy summon its slice's power beats as well. */
private object NoQuarter : EffectBehaviour {
    override val reads = setOf("chance")

    override fun friendActed(scene: Scene, summon: Summon): List<Change> {
        if (summon.kind != MERCENARY) return emptyList()
        val beatable = scene.beatable(scene.ownPower(scene.slice))
        if (beatable.isEmpty() || !scene.chance(scene.number("chance"))) return emptyList()
        return listOf(Change.Kill(scene.pick(beatable).serial, summon.actor, scene.effect))
    }
}

/** Sweeter Terms: each enemy summon turns to its side, with a `strong` chance when its slice's power beats its integrity and a `weak` one when not. */
private object SweeterTerms : EffectBehaviour {
    override val reads = setOf("strong", "weak")

    override fun activated(scene: Scene): List<Change> = scene.summons(scene.side.other).filterNot { it.onTheLine }.mapNotNull { summon ->
        val chance = scene.number(if (scene.ownPower(scene.slice) > summon.integrity) "strong" else "weak")
        if (scene.chance(chance)) Change.Turn(summon.serial, scene.side, scene.slice, scene.actor, scene.effect!!) else null
    }
}

/** Endless Parley: `perSecond` a second, and, while the tug favours the opponent, their power `power` lower. */
private object Parley : EffectBehaviour {
    override val reads = setOf("perSecond", "power")

    override fun everySecond(scene: Scene): List<Change> =
        listOf(Change.Pull(scene.side, scene.boost(scene.number("perSecond")), scene.actor, scene.effect, scene.boosted))

    override fun aura(scene: Scene): Double = if (scene.favours(scene.side.other)) scene.boost(scene.number("power")) else 0.0
}

private const val MERCENARY = "mercenary"

internal val violenceAndDiplomacy: Map<String, EffectBehaviour> = mapOf(
    "violence.sellswords" to Hires,
    "violence.noQuarter" to NoQuarter,
    "violence.spoils" to ChangingAway(Aspect.VIOLENCE),
    "diplomacy.envoy" to Slotted,
    "diplomacy.sweeterTerms" to SweeterTerms,
    "diplomacy.parley" to Parley,
)

internal val violenceAndDiplomacySummons: Map<String, SummonBehaviour> = mapOf(MERCENARY to Pulls)
