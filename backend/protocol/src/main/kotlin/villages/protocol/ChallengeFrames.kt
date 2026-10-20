package villages.protocol

import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo

/*
 * How the challenges' inspect page has the game server fight a challenge out and show it every moment: an
 * instrument, as the catalogue pages' frames are, answered only to the page that asked, and refused while the
 * instruments are closed. Nothing is stored. See decision record 0105.
 */

/**
 * Fight this challenge out: [id] the page's own, which the answer carries back; each side's slices; its progression;
 * and the [seed], a whole number the page can type back, or none for the server to draw one.
 */
data class SimulateChallenge(
    val id: String,
    val a: List<SliceView>,
    val b: List<SliceView>,
    val progression: ProgressionView,
    val seed: Long? = null,
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
) : ServerFrame

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
)

/** A summon that came on the field: its serial, its kind - a summon's id, or `onTheLine` - and a thing on the line's name. */
data class SummonSeenView(val serial: Int, val kind: String, val called: String?)

/** A challenge not fought: `invalidSetup`, saying why, or `instrumentsClosed`. */
data class SimulationRefused(val id: String, val code: String, val reason: String) : ServerFrame
