package villages.domain.challenge

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.domain.Stat
import java.io.File
import java.util.Locale

/**
 * One challenge fought from one seed and written out as a table, kept beside the specs: a change to the rules that
 * moves any moment of it fails here, and the table is what a person reads to judge whether the rules read as meant.
 * Written afresh with `-Dchallenge.record=true`, and when it is not there yet.
 */
class GoldenLogSpec : StringSpec({

    "Violence against Diplomacy, from the seed 20261020, is the table kept beside the specs" {
        val ines = StandIn.KeyFigure("Ines", mapOf(Stat.KINDNESS to 12))
        val result = fight(
            a = listOf(slice(Aspect.VIOLENCE, "violence.sellswords", "violence.noQuarter", power = 60.0)),
            b = listOf(
                slice(Aspect.DIPLOMACY, "diplomacy.envoy", "diplomacy.sweeterTerms", summonCount = 2, slotted = mapOf("diplomacy.envoy" to ines)),
                slice(Aspect.VIOLENCE, "violence.sellswords", "violence.spoils", integrity = 40.0),
            ),
            seconds = 24,
            Happening(Aspect.VIOLENCE),
            Happening(Aspect.DIPLOMACY),
            Happening(Aspect.REASON),
            Happening(Aspect.VIOLENCE, Aspect.DIPLOMACY),
            seed = 20261020,
        )
        val table = tableOf(result)
        val kept = File("src/test/resources/challenge/violence-against-diplomacy.txt")
        if (System.getProperty("challenge.record") == "true" || !kept.exists()) {
            kept.parentFile.mkdirs()
            kept.writeText(table)
            error("recorded ${kept.path}: read it, and run again")
        }
        table shouldBe kept.readText()
    }
})

/** A challenge as a table: one line a moment, then its outcome. */
fun tableOf(result: ChallengeResult): String = buildString {
    appendLine(String.format(Locale.ROOT, "%3s %2s %-4s %-12s %-15s %-22s %-14s %7s %7s %7s", "s", "h", "side", "who", "what", "effect", "target", "amount", "change", "tug"))
    result.moments.forEach { moment ->
        appendLine(
            String.format(
                Locale.ROOT,
                "%3d %2d %-4s %-12s %-15s %-22s %-14s %7s %7s %7s",
                moment.second,
                moment.happening,
                moment.side?.name ?: "",
                who(moment.actor),
                moment.what.name.lowercase().replace('_', ' '),
                (moment.effect ?: moment.targetEffect ?: "") + if (moment.boosted) " ×" else "",
                moment.target?.let(::who) ?: "",
                moment.amount?.let(::number) ?: "",
                if (moment.tugDelta == 0.0) "" else number(moment.tugDelta),
                number(moment.tugAfter),
            ).trimEnd(),
        )
    }
    val outcome = result.outcome
    appendLine("ended ${outcome.ended.name.lowercase()} in second ${outcome.second}, the tug ${number(outcome.tug)}, won by ${outcome.wonBy ?: "nobody"}")
    outcome.gains.forEach { appendLine("gained: ${it.side} ${number(it.amount)} ${it.resource.name.lowercase()} by ${it.effect}") }
    outcome.losses.forEach { appendLine("lost: ${it.side} ${it.name}, ${number(it.effectiveness)}% effectiveness, on the line by ${it.effect}") }
}

private fun who(actor: Actor): String = when (actor) {
    is Actor.OfSlice -> actor.toString()
    is Actor.OfSummon -> "#${actor.serial} ${actor.called ?: actor.kind}"
    Actor.TheChallenge -> "-"
}

private fun number(value: Double): String = if (value == Math.rint(value)) "%.0f".format(Locale.ROOT, value) else "%.1f".format(Locale.ROOT, value)
