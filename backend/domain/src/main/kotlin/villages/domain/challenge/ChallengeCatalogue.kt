package villages.domain.challenge

import villages.domain.Stat

/**
 * The challenge's content as the rules read it, from `world/catalogues/challenges.json`: the effects a slice carries,
 * the summons they bring, and the kinds of challenge a progression is drawn from. The names and the words are the
 * page's and are not here; an effect is known by its [ChallengeEffect.id] and its numbers by their names, which its
 * behaviour reads. A catalogue that breaks one of the rules below is refused whole. See decision record 0107.
 */
data class ChallengeCatalogue(
    val effects: List<ChallengeEffect>,
    val summons: Map<String, SummonSpec>,
    val kinds: Map<String, ChallengeKind>,
) {
    init {
        require(effects.map { it.id }.toSet().size == effects.size) { "an effect has an id of its own" }
        effects.forEach { effect ->
            require(effect.summons == null || effect.summons in summons) { "${effect.id} summons ${effect.summons}, which is not a summon" }
        }
    }

    fun effect(id: String): ChallengeEffect? = effects.firstOrNull { it.id == id }

    /** The effects of one aspect, as a slice of it chooses from. */
    fun effectsOf(aspect: Aspect): List<ChallengeEffect> = effects.filter { it.aspect == aspect }

    companion object {
        /** No content at all: what a world with no challenges' catalogue reads, as in tests of something else. */
        val NONE = ChallengeCatalogue(emptyList(), emptyMap(), emptyMap())
    }
}

/** Whether an effect fires as its slice meets each happening, or works from second to second. */
enum class Fires { TRIGGER, PASSIVE }

/**
 * One effect: `violence.sellswords`, its [aspect]'s name and its own. What it does is its behaviour's, in code; what
 * it does it with is here - its [numbers] by name, the summon it brings, and the [slot] it gives its slice.
 */
data class ChallengeEffect(
    val id: String,
    val aspect: Aspect,
    val fires: Fires,
    val numbers: Map<String, Double> = emptyMap(),
    val summons: String? = null,
    val slot: ChallengeSlot? = null,
    /** Whether it needs a matching aspect: works only while the latest happening has its slice's aspect. */
    val matching: Boolean = false,
) {
    init {
        require(id.startsWith("${aspect.name.lowercase()}.")) { "an effect's id begins with its aspect, not $id" }
        require(numbers.values.all { it >= 0.0 && it.isFinite() }) { "$id's numbers are nothing or more, not $numbers" }
    }

    /** A number its behaviour reads, which the catalogue must give it. */
    fun number(name: String): Double = numbers[name] ?: error("$id has no number '$name'")
}

/** What a slot an effect brings fits: a key figure, or a structure its side holds. */
enum class Fits { KEY_FIGURE, STRUCTURE }

/**
 * A place an effect gives its slice for something its side holds. A key figure lends one of their stats; anything
 * [onTheLine] stands in the challenge as a summon instead, and can be lost.
 */
data class ChallengeSlot(val fits: Fits, val lends: Stat? = null, val onTheLine: Boolean = false) {
    init {
        require(lends == null || fits == Fits.KEY_FIGURE) { "only a key figure lends a stat" }
        require(lends != null || onTheLine) { "a slot lends a stat or puts what is in it on the line" }
    }
}

/** One summon: its aspect, by which its boost is judged, and its numbers by name. */
/** A kind of summon: its [aspect], its [numbers], and whether it needs a [matching] aspect - acts only while the happening has its own. */
data class SummonSpec(val aspect: Aspect, val numbers: Map<String, Double> = emptyMap(), val matching: Boolean = false) {
    init {
        require(numbers.values.all { it >= 0.0 && it.isFinite() }) { "a summon's numbers are nothing or more, not $numbers" }
    }

    fun number(name: String): Double = numbers[name] ?: error("a summon has no number '$name'")
}

/**
 * A kind of challenge - a battle, a debate - as a progression is drawn from it: the [seconds] it lasts and the
 * [happenings] it has, each the least and the most; the chance out of a hundred that a happening has a second
 * aspect; and how much each aspect weighs, an aspect not named weighing nothing.
 */
data class ChallengeKind(
    val seconds: IntRange,
    val happenings: IntRange,
    val twoAspects: Double,
    val weights: Map<Aspect, Double>,
) {
    init {
        require(seconds.first >= 1 && !seconds.isEmpty()) { "a challenge lasts a second at least, from fewest to most, not $seconds" }
        require(happenings.first >= 1 && !happenings.isEmpty()) { "a challenge has a happening at least, from fewest to most, not $happenings" }
        require(happenings.last <= seconds.first) { "never more happenings than the fewest seconds, so each begins on a second of its own" }
        require(twoAspects in 0.0..100.0) { "twoAspects is a chance out of a hundred, not $twoAspects" }
        require(weights.values.all { it >= 0.0 && it.isFinite() }) { "a weight is nothing or more, not $weights" }
        require(weights.values.sum() > 0.0) { "some aspect weighs something" }
    }
}
