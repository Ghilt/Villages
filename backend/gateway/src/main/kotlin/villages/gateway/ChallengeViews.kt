package villages.gateway

import villages.application.Fought
import villages.application.Matchups
import villages.domain.challenge.Actor
import villages.domain.challenge.Aspect
import villages.domain.challenge.ChallengeResult
import villages.domain.challenge.ChallengeSetup
import villages.domain.challenge.ChallengeSlice
import villages.domain.challenge.Fits
import villages.domain.challenge.Happening
import villages.domain.challenge.Outcome
import villages.domain.challenge.Progression
import villages.domain.challenge.Side
import villages.domain.challenge.StandIn
import villages.protocol.BatchView
import villages.protocol.ChallengeSimulated
import villages.protocol.GainView
import villages.protocol.LossView
import villages.protocol.MatchupView
import villages.protocol.MatchupsSimulated
import villages.protocol.MomentView
import villages.protocol.OutcomeView
import villages.protocol.ProgressionView
import villages.protocol.SliceView
import villages.protocol.StandInView
import villages.protocol.SummonSeenView

/**
 * A challenge between the wire and the domain: the page's setup read into the engine's, a name it cannot read refused
 * by name, and a challenge fought written out flat, every moment a row the page can tabulate. See decision record 0107.
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

internal fun Progression.toView(): ProgressionView =
    ProgressionView(seconds, happenings.map { happening -> happening.aspects.map { it.name.lowercase() } })

/** An aspect named on the wire, which is its name in lower case, or the refusal. */
private fun asAspect(name: String): Aspect =
    Aspect.entries.firstOrNull { it.name.lowercase() == name } ?: throw IllegalArgumentException("not an aspect: $name")

/** A slice as the wire says it, every stand-in slotted with it. */
internal fun ChallengeSlice.toView(): SliceView = SliceView(
    aspect = aspect.name.lowercase(),
    power = power,
    integrity = integrity,
    summonCount = summonCount,
    effects = effects,
    slotted = slotted.mapValues { (_, standIn) ->
        when (standIn) {
            is StandIn.KeyFigure -> StandInView.KeyFigure(standIn.name, standIn.stats.mapKeys { (stat, _) -> stat.name.lowercase() })
            is StandIn.Building -> StandInView.Building(standIn.name, standIn.level)
        }
    },
)

internal fun Fought.toFrame(id: String, catalogue: String): ChallengeSimulated {
    val (setup, result) = this
    return ChallengeSimulated(
        id = id,
        seed = result.seed,
        catalogue = catalogue,
        progression = setup.progression.toView(),
        outcome = result.outcome.toView(),
        moments = result.momentViews(),
        summons = result.summonViews(),
        batch = batch?.let { BatchView(it.runs, it.wonByA, it.wonByB, it.even, it.pulledByA, it.pulledByB, it.meanTug, it.tugEnds, it.spread, it.ends) },
    )
}

/** Every summon that came on the field in a challenge fought, by its serial, which the moments name it by. */
internal fun ChallengeResult.summonViews(): List<SummonSeenView> =
    moments.flatMap { listOfNotNull(it.actor, it.target) }.filterIsInstance<Actor.OfSummon>()
        .distinctBy { it.serial }.sortedBy { it.serial }
        .map { SummonSeenView(it.serial, it.kind, it.called) }

/** A challenge fought, its every moment a row the page can tabulate. */
internal fun ChallengeResult.momentViews(): List<MomentView> =
    moments.map {
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
            status = it.status,
        )
    }

/** What a challenge came to, flat: the tug, how it ended, the second, who won, and its gains and losses. */
internal fun Outcome.toView(): OutcomeView = OutcomeView(
    tug = tug,
    ended = ended.name.lowerCamel(),
    second = second,
    wonBy = wonBy?.toWire(),
    gains = gains.map { GainView(it.side.toWire(), it.resource.toWire(), it.amount, it.effect) },
    losses = losses.map {
        LossView(it.side.toWire(), it.name, if (it.fits == Fits.STRUCTURE) "damaged" else "fatigued", it.effectiveness, it.effect)
    },
)

private fun Side.toWire(): String = name.lowercase()

private fun Actor.toWire(): String = when (this) {
    is Actor.OfSlice, is Actor.OfSummon -> toString()
    Actor.TheChallenge -> "challenge"
}

/** `HAPPENING_BEGAN` as the wire says it, `happeningBegan`. */
private fun String.lowerCamel(): String =
    lowercase().split('_').mapIndexed { at, word -> if (at == 0) word else word.replaceFirstChar(Char::uppercase) }.joinToString("")

internal fun Matchups.toFrame(id: String, catalogue: String): MatchupsSimulated = MatchupsSimulated(
    id = id,
    kind = kind,
    runs = runs,
    seed = seed,
    catalogue = catalogue,
    aspects = aspects.map { it.name.lowercase() },
    cells = cells.map { row -> row.map { MatchupView(it.wonByA, it.wonByB, it.even, it.pulled, it.meanTug) } },
)
