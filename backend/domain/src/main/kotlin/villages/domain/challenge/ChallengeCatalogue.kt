package villages.domain.challenge

import villages.domain.Stat

/**
 * The challenge's content as the rules read it, from `world/catalogues/challenges.json`: the effects a slice carries,
 * the summons they bring, the buffs and debuffs they put on, and the kinds of challenge a progression is drawn from. The names and the words are the
 * page's and are not here; an effect is known by its [ChallengeEffect.id] and its numbers by their names, which its
 * behaviour reads. A catalogue that breaks one of the rules below is refused whole. See decision record 0107.
 */
data class ChallengeCatalogue(
    val effects: List<ChallengeEffect>,
    val summons: Map<String, SummonSpec>,
    val kinds: Map<String, ChallengeKind>,
    val buffs: Map<String, Lasting> = emptyMap(),
    val debuffs: Map<String, Lasting> = emptyMap(),
    /**
     * The slices every house holds until houses come by their own, by their ids: what a house chooses from to bring to
     * a challenge a quest puts to it. See decision record 0107, amended.
     */
    val starting: Map<String, ChallengeSlice> = emptyMap(),
) {
    init {
        require(effects.map { it.id }.toSet().size == effects.size) { "an effect has an id of its own" }
        require(buffs.keys.none { it in debuffs }) { "a buff and a debuff have ids of their own, not ${buffs.keys.filter { it in debuffs }}" }
        effects.forEach { effect ->
            require(effect.summons == null || effect.summons in summons) { "${effect.id} summons ${effect.summons}, which is not a summon" }
            require(effect.puts == null || lasting(effect.puts) != null) { "${effect.id} puts on ${effect.puts}, which is no buff or debuff" }
        }
        summons.forEach { (id, spec) ->
            require(spec.puts == null || lasting(spec.puts) != null) { "$id puts on ${spec.puts}, which is no buff or debuff" }
        }
    }

    /** A buff or a debuff by its id; none when it is neither. */
    fun lasting(id: String): Lasting? = buffs[id] ?: debuffs[id]

    fun effect(id: String): ChallengeEffect? = effects.firstOrNull { it.id == id }

    /** The effects of one aspect, as a slice of it chooses from. */
    fun effectsOf(aspect: Aspect): List<ChallengeEffect> = effects.filter { it.aspect == aspect }

    companion object {
        /** No content at all: what a world with no challenges' catalogue reads, as in tests of something else. */
        val NONE = ChallengeCatalogue(emptyList(), emptyMap(), emptyMap())
    }
}

/**
 * What an effect or a kind of summon needs of the latest happening to work: its [MATCH]ing aspect, or its [ANTI]-aspect,
 * the second being how a slice is made to meet its anti-aspect's happenings. Neither, it works in every happening.
 */
enum class Needs { MATCH, ANTI }

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
    /** What it needs to work: a matching aspect, or its anti-aspect, in the latest happening; none to work in any. */
    val needs: Needs? = null,
    /** The buff or the debuff it puts on, by its id; none for one that puts nothing on. */
    val puts: String? = null,
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
/** A kind of summon: its [aspect], its [numbers], and what it [needs] to act - its own aspect, or its anti-aspect, in the happening; none to act in any. */
data class SummonSpec(
    val aspect: Aspect,
    val numbers: Map<String, Double> = emptyMap(),
    val needs: Needs? = null,
    /** The buff or the debuff its acts put on, by its id; none for one that puts nothing on. */
    val puts: String? = null,
) {
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

/** What a buff or a debuff goes on. */
enum class Bearer { SLICE, SUMMON }

/**
 * A buff, which helps, or a debuff, which hinders: what it goes [on] - slices, summons or both, as its words say - and
 * its own [numbers]. An effect or a summon puts it on for the seconds they say; what it does while it is on is its
 * behaviour's, in code, by its id. Named for what it does, so that effects of many flavours can put on the same one.
 */
data class Lasting(val on: Set<Bearer>, val numbers: Map<String, Double> = emptyMap()) {
    init {
        require(on.isNotEmpty()) { "a buff or a debuff goes on something" }
        require(numbers.values.all { it >= 0.0 && it.isFinite() }) { "a buff's or a debuff's numbers are nothing or more, not $numbers" }
    }

    fun number(name: String): Double = numbers[name] ?: error("a buff or a debuff has no number '$name'")
}
