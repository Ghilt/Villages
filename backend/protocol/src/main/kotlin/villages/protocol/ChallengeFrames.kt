package villages.protocol

import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo

/*
 * How the challenges' inspect page has the game server fight a challenge out and show it every moment: an
 * instrument, as the catalogue pages' frames are, answered only to the page that asked, and refused while the
 * instruments are closed. Nothing is stored. See decision record 0107.
 */

/**
 * Fight this challenge out: [id] the page's own, which the answer carries back; each side's slices; its progression
 * written by hand, or the challenge [kind] to draw one from; and the [seed], a whole number the page can type back, or
 * none for the server to draw one.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class SimulateChallenge(
    val id: String,
    val a: List<SliceView>,
    val b: List<SliceView>,
    val progression: ProgressionView? = null,
    val kind: String? = null,
    val seed: Long? = null,
    /** How many times to fight it, a batch summed, from 1 to 10000; none is once. */
    val runs: Int? = null,
) : ClientFrame

/** A slice as the page builds it: its aspect by its name, `violence`, and what stands in its effects' slots. */
data class SliceView(
    val aspect: String,
    val power: Double,
    val integrity: Double,
    val summonCount: Int,
    val effects: List<String>,
    val slotted: Map<String, StandInView> = emptyMap(),
)

/** What a page puts in a slot: a key figure, with their four stats by name, or a building, with its level. */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "kind")
@JsonSubTypes(
    JsonSubTypes.Type(StandInView.KeyFigure::class, name = "keyFigure"),
    JsonSubTypes.Type(StandInView.Building::class, name = "building"),
)
sealed interface StandInView {
    data class KeyFigure(val name: String, val stats: Map<String, Int>) : StandInView

    data class Building(val name: String, val level: Int) : StandInView
}

/** A progression: its seconds, and its happenings in order, each its aspects by name. */
data class ProgressionView(val seconds: Int, val happenings: List<List<String>>)

/**
 * A challenge fought: the page's [id], the [seed] it was fought from, the fingerprint of the challenges' catalogue it
 * was fought with, its progression, what it came to, its moments in order, and every summon that came on the field by
 * its serial, which the moments name it by.
 */
data class ChallengeSimulated(
    val id: String,
    val seed: Long,
    val catalogue: String,
    val progression: ProgressionView,
    val outcome: OutcomeView,
    val moments: List<MomentView>,
    val summons: List<SummonSeenView>,
    /** What a batch came to, when more than one run was asked for; the moments are its first run's. */
    @get:JsonInclude(JsonInclude.Include.NON_NULL) val batch: BatchView? = null,
) : ServerFrame

/**
 * A batch: how many runs, each side's wins, the even ends, each side's pulls to the end, the mean end tug toward A, and
 * how the runs spread: for every second, how many stood in each of twenty-two bands of the tug - pulled to B's end,
 * twenty of equal width between the ends, pulled to A's end - and in which band each ended.
 */
data class BatchView(
    val runs: Int,
    val wonByA: Int,
    val wonByB: Int,
    val even: Int,
    val pulledByA: Int,
    val pulledByB: Int,
    val meanTug: Double,
    val tugEnds: Double,
    val spread: List<List<Int>>,
    val ends: List<Int>,
)

/** What a challenge came to: the tug toward side A, `pulled` or `timeRanOut`, the second, `a`, `b` or none who won. */
data class OutcomeView(
    val tug: Double,
    val ended: String,
    val second: Int,
    val wonBy: String?,
    val gains: List<GainView>,
    val losses: List<LossView>,
)

data class GainView(val side: String, val resource: String, val amount: Double, val effect: String)

/** A building `damaged` or a person `fatigued`, killed on the line, with the effectiveness lost out of a hundred. */
data class LossView(val side: String, val name: String, val became: String, val effectiveness: Double, val effect: String)

/**
 * One moment: who acted - a slice, `a1`, a summon, `#7`, or `challenge` - what they did, by which effect, to whom, how
 * much and whether boosted, the change to the tug and the tug after, and the effect the deed was done to.
 */
data class MomentView(
    val second: Int,
    val happening: Int,
    val side: String?,
    val actor: String,
    val what: String,
    val effect: String?,
    val target: String?,
    val amount: Double?,
    val boosted: Boolean,
    val tugDelta: Double,
    val tugAfter: Double,
    val targetEffect: String?,
    /** The buff or the debuff the moment put on or lifted, by its id. */
    val status: String?,
)

/** A summon that came on the field: its serial, its kind - a summon's id, or `onTheLine` - and a thing on the line's name. */
data class SummonSeenView(val serial: Int, val kind: String, val called: String?)

/** A challenge not fought: `invalidSetup`, saying why, or `instrumentsClosed`. */
data class SimulationRefused(val id: String, val code: String, val reason: String) : ServerFrame

/**
 * Weigh every aspect against every other: for each pair, a slice of the one against a slice of the other, fought [runs]
 * times on progressions drawn from the challenge [kind], from the [seed] or one the server draws.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class SimulateMatchups(val id: String, val kind: String, val runs: Int, val seed: Long? = null) : ClientFrame

/**
 * Every aspect weighed against every other: the [aspects] in their order, and [cells] by side A's aspect, then side
 * B's, each pairing's runs summed.
 */
data class MatchupsSimulated(
    val id: String,
    val kind: String,
    val runs: Int,
    val seed: Long,
    val catalogue: String,
    val aspects: List<String>,
    val cells: List<List<MatchupView>>,
) : ServerFrame

/** One pairing's runs: each side's wins, the even ends, how many were pulled to an end, and the mean end tug toward A. */
data class MatchupView(val wonByA: Int, val wonByB: Int, val even: Int, val pulled: Int, val meanTug: Double)
