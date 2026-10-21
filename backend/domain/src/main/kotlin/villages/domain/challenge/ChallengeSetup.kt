package villages.domain.challenge

import villages.domain.Stat

/**
 * What a side brings to a challenge: a slice, its [aspect], its [power] and [integrity], how many summons it lets its
 * side have, the [effects] it carries by their ids, two at most and of its own aspect, and what stands in the slots
 * they bring, by the effect's id. See decision record 0107.
 */
data class ChallengeSlice(
    val aspect: Aspect,
    val power: Double,
    val integrity: Double,
    val summonCount: Int,
    val effects: List<String>,
    val slotted: Map<String, StandIn> = emptyMap(),
)

/**
 * What stands in a slot. In the simulator a stand-in made up on the page; in the game one day a house's own key
 * figure or building. A key figure lends one of their [KeyFigure.stats]; a building brings its [Building.level].
 */
sealed interface StandIn {
    val name: String

    data class KeyFigure(override val name: String, val stats: Map<Stat, Int>) : StandIn {
        fun stat(stat: Stat): Int = stats[stat] ?: 0
    }

    data class Building(override val name: String, val level: Int) : StandIn

    /** What a slot that fits [fits] can take. */
    fun fits(fits: Fits): Boolean = when (this) {
        is KeyFigure -> fits == Fits.KEY_FIGURE
        is Building -> fits == Fits.STRUCTURE
    }
}

/** One step of a progression: its aspects, the first named first, one at least. */
data class Happening(val aspects: List<Aspect>) {
    constructor(vararg aspects: Aspect) : this(aspects.toList())

    /** Whether a thing of [aspect] is boosted in it: its aspect or its anti-aspect is among the happening's. */
    fun boosts(aspect: Aspect): Boolean = aspects.any { it == aspect || it == aspect.anti }
}

/** A challenge's happenings in order over its [seconds], the first at the start and the rest spaced evenly. */
data class Progression(val seconds: Int, val happenings: List<Happening>) {
    /** The second happening [index] begins at. */
    fun startOf(index: Int): Int = index * seconds / happenings.size
}

/** A whole challenge before it is fought: what each side brings, and its progression. */
data class ChallengeSetup(val a: List<ChallengeSlice>, val b: List<ChallengeSlice>, val progression: Progression) {
    fun side(side: Side): List<ChallengeSlice> = if (side == Side.A) a else b

    /** Why this setup cannot be fought with [catalogue], a line a reason; none when it can. */
    fun refusals(catalogue: ChallengeCatalogue): List<String> = buildList {
        val (seconds, happenings) = progression
        if (seconds !in 1..MOST_SECONDS) add("a challenge lasts from 1 to $MOST_SECONDS seconds, not $seconds")
        if (happenings.isEmpty() || happenings.size > seconds) add("a challenge has a happening at least, and no more than it has seconds")
        if (happenings.any { it.aspects.isEmpty() }) add("every happening has an aspect at least")
        Side.entries.forEach { side ->
            val slices = side(side)
            if (slices.size !in 1..MOST_SLICES) add("side ${side.name} brings 1 to $MOST_SLICES slices, not ${slices.size}")
            slices.forEachIndexed { at, slice -> addAll(sliceRefusals(catalogue, "${side.name.lowercase()}${at + 1}", slice)) }
        }
    }

    private fun sliceRefusals(catalogue: ChallengeCatalogue, label: String, slice: ChallengeSlice): List<String> = buildList {
        if (slice.power < 0.0 || slice.integrity < 0.0 || slice.summonCount < 0) add("$label starts at nothing or more")
        if (slice.effects.size > MOST_EFFECTS) add("$label carries $MOST_EFFECTS effects at most")
        if (slice.effects.toSet().size != slice.effects.size) add("$label carries an effect once")
        slice.effects.forEach { id ->
            val effect = catalogue.effect(id)
            when {
                effect == null -> add("$label carries $id, which is not an effect")
                effect.aspect != slice.aspect -> add("$label is ${slice.aspect.name.lowercase()} and carries $id, of another aspect")
            }
        }
        slice.slotted.forEach { (id, standIn) ->
            val slot = catalogue.effect(id)?.slot
            when {
                id !in slice.effects || slot == null -> add("$label has ${standIn.name} in a slot of $id, which it does not carry or has none")
                !standIn.fits(slot.fits) -> add("$label's slot of $id does not fit ${standIn.name}")
            }
        }
    }

    companion object {
        const val MOST_SECONDS = 600
        const val MOST_SLICES = 3
        const val MOST_EFFECTS = 2
    }
}
