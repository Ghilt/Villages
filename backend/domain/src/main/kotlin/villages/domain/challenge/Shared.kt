package villages.domain.challenge

/** Behaviours several effects and summons share, each told apart by its catalogue entry's numbers. */

/** Hires the summon its catalogue entry names, each time its slice comes on stage. */
internal object Hires : EffectBehaviour {
    override fun activated(scene: Scene): List<Change> = scene.hire()
}

/** Asks for its slot each time its slice comes on stage: a key figure lends, a thing on the line comes on it, once. */
internal object Slotted : EffectBehaviour {
    override fun activated(scene: Scene): List<Change> = scene.slotFires()
}

/** Pulls its `amount` when the happening changes away from [from], boosted by the happening it changes to. */
internal class ChangingAway(private val from: Aspect) : EffectBehaviour {
    override val reads = setOf("amount")

    override fun changed(scene: Scene): List<Change> {
        val was = scene.previous ?: return emptyList()
        if (from !in was.aspects || from in scene.happening.aspects) return emptyList()
        return listOf(Change.Pull(scene.side, scene.boost(scene.number("amount")), scene.actor, scene.effect, scene.boosted))
    }
}

/** A summon that pulls its `pulls` an act. */
internal object Pulls : SummonBehaviour {
    override val reads = setOf("pulls")

    override fun pull(scene: Scene, summon: Summon): Double = scene.boost(scene.number("pulls"))

    override fun act(scene: Scene, summon: Summon): List<Change> =
        listOf(Change.Pull(summon.side, pull(scene, summon), summon.actor, null, scene.boosted))
}

/** A summon that pulls its `pulls` an act, and its `behind` while its side is behind. */
internal object PullsHarderBehind : SummonBehaviour {
    override val reads = setOf("pulls", "behind")

    override fun pull(scene: Scene, summon: Summon): Double =
        scene.boost(scene.number(if (scene.favours(summon.side.other)) "behind" else "pulls"))

    override fun act(scene: Scene, summon: Summon): List<Change> =
        listOf(Change.Pull(summon.side, pull(scene, summon), summon.actor, null, scene.boosted))
}

/** The enemy summons [scene]'s side can kill with a power of [power]: those whose integrity it beats. */
internal fun Scene.beatable(power: Double): List<Summon> = summons(side.other).filter { power > it.integrity }

/** What of its own side an effect puts its buff on: its slices, its summons, or both. */
internal enum class Own { SLICES, SUMMONS, BOTH }

/** Puts the buff its entry names on every one of [own] of its side for `seconds`, as it fires. */
internal class Rallies(private val own: Own) : EffectBehaviour {
    override val reads = setOf("seconds")

    override fun activated(scene: Scene): List<Change> {
        val slices = if (own == Own.SUMMONS) emptyList() else scene.slices(scene.side)
        val summons = if (own == Own.SLICES) emptyList() else scene.summons(scene.side).map { it.actor }
        return (slices + summons).map { scene.putOn(it, scene.number("seconds")) }
    }
}

/** Puts the debuff its entry names on every one of [enemy]'s side for `seconds`, as it fires: slices, summons, or both. */
internal class Afflicts(private val enemy: Own) : EffectBehaviour {
    override val reads = setOf("seconds")

    override fun activated(scene: Scene): List<Change> {
        val them = scene.side.other
        val slices = if (enemy == Own.SUMMONS) emptyList() else scene.slices(them)
        val summons = if (enemy == Own.SLICES) emptyList() else scene.summons(them).map { it.actor }
        return (slices + summons).map { scene.putOn(it, scene.number("seconds")) }
    }
}
