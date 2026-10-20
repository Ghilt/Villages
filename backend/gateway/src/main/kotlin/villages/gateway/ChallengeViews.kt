package villages.gateway

import villages.application.Fought
import villages.domain.challenge.Actor
import villages.domain.challenge.Aspect
import villages.domain.challenge.ChallengeSetup
import villages.domain.challenge.ChallengeSlice
import villages.domain.challenge.Fits
import villages.domain.challenge.Happening
import villages.domain.challenge.Progression
import villages.domain.challenge.Side
import villages.domain.challenge.StandIn
import villages.protocol.BatchView
import villages.protocol.ChallengeSimulated
import villages.protocol.GainView
import villages.protocol.LossView
import villages.protocol.MomentView
import villages.protocol.OutcomeView
import villages.protocol.ProgressionView
import villages.protocol.SliceView
import villages.protocol.StandInView
import villages.protocol.SummonSeenView

/**
 * A challenge between the wire and the domain: the page's setup read into the engine's, a name it cannot read refused
 * by name, and a challenge fought written out flat, every moment a row the page can tabulate. See decision record 0105.
 */
internal fun SliceView.toSlice(): ChallengeSlice = ChallengeSlice(
    aspect = asAspect(aspect),
    power = power,
    integrity = integrity,
    summonCount = summonCount,
    effects = effects,
    slotted = slotted.mapValues { (_, standIn) ->
        when (standIn) {
            is StandInView.KeyFigure -> StandIn.KeyFigure(standIn.name, standIn.stats.mapKeys { (stat, _) -> asStat(stat) })
            is StandInView.Building -> StandIn.Building(standIn.name, standIn.level)
        }
    },
)

internal fun ProgressionView.toProgression(): Progression =
    Progression(seconds, happenings.map { aspects -> Happening(aspects.map(::asAspect)) })

private fun Progression.toView(): ProgressionView =
    ProgressionView(seconds, happenings.map { happening -> happening.aspects.map { it.name.lowercase() } })

/** An aspect named on the wire, which is its name in lower case, or the refusal. */
private fun asAspect(name: String): Aspect =
    Aspect.entries.firstOrNull { it.name.lowercase() == name } ?: throw IllegalArgumentException("not an aspect: $name")

internal fun Fought.toFrame(id: String, catalogue: String): ChallengeSimulated {
    val (setup, result) = this
    val (seed, moments, outcome) = result
    val summons = moments.flatMap { listOfNotNull(it.actor, it.target) }.filterIsInstance<Actor.OfSummon>()
        .distinctBy { it.serial }.sortedBy { it.serial }
        .map { SummonSeenView(it.serial, it.kind, it.called) }
    return ChallengeSimulated(
        id = id,
        seed = seed,
        catalogue = catalogue,
        progression = setup.progression.toView(),
        outcome = OutcomeView(
            tug = outcome.tug,
            ended = outcome.ended.name.lowerCamel(),
            second = outcome.second,
            wonBy = outcome.wonBy?.toWire(),
            gains = outcome.gains.map { GainView(it.side.toWire(), it.resource.toWire(), it.amount, it.effect) },
            losses = outcome.losses.map {
                LossView(it.side.toWire(), it.name, if (it.fits == Fits.STRUCTURE) "damaged" else "fatigued", it.effectiveness, it.effect)
            },
        ),
        moments = moments.map {
            MomentView(
                second = it.second,
                happening = it.happening,
                side = it.side?.toWire(),
                actor = it.actor.toWire(),
                what = it.what.name.lowerCamel(),
                effect = it.effect,
                target = it.target?.toWire(),
                amount = it.amount,
                boosted = it.boosted,
                tugDelta = it.tugDelta,
                tugAfter = it.tugAfter,
                targetEffect = it.targetEffect,
            )
        },
        summons = summons,
        batch = batch?.let { BatchView(it.runs, it.wonByA, it.wonByB, it.even, it.pulledByA, it.pulledByB, it.meanTug) },
    )
}

private fun Side.toWire(): String = name.lowercase()

private fun Actor.toWire(): String = when (this) {
    is Actor.OfSlice, is Actor.OfSummon -> toString()
    Actor.TheChallenge -> "challenge"
}

/** `HAPPENING_BEGAN` as the wire says it, `happeningBegan`. */
private fun String.lowerCamel(): String =
    lowercase().split('_').mapIndexed { at, word -> if (at == 0) word else word.replaceFirstChar(Char::uppercase) }.joinToString("")
