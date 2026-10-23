package villages.gateway

import villages.application.ChallengeRow
import villages.application.ChallengesByHouse
import villages.domain.HouseId
import villages.domain.PlayerId
import villages.protocol.ChallengeRowView
import villages.protocol.OpponentView
import villages.protocol.YourChallenges

/**
 * A house's challenges: every one it fought reaches its player wherever they are looking, as its quests do, because
 * what a house fought is its own and needs no cell. Each window is told the whole history on hello, and again when it
 * changes. See decision record 0107, amended.
 */
internal class ChallengeHistoryPart(private val core: Core, private val rows: ChallengesByHouse) : Part {
    private val changed: AutoCloseable = rows.watch { change ->
        core.sessionOf(change.player)?.let { tell(it, change.challenges) }
    }

    override fun greet(connection: Gateway.Connection, who: PlayerId) {
        tell(connection, rows.of(HouseId.of(who)))
    }

    private fun tell(connection: Gateway.Connection, challenges: List<ChallengeRow>) {
        connection.out.send(YourChallenges(challenges.map { it.toView() }))
    }

    override fun close() {
        changed.close()
    }
}

/** A challenge as its history says it, on the wire. */
internal fun ChallengeRow.toView(): ChallengeRowView = ChallengeRowView(
    id = id.value.toString(),
    revision = revision,
    title = title,
    quest = questTitle,
    kind = kind,
    house = houseName,
    against = OpponentView(against.name, against.colour),
    brought = brought,
    outcome = outcome.toView(),
    foughtAt = foughtAt.toString(),
    then = then,
)

/** The challenges' history's place in the gateway: told after the quests, which raised them. */
class ChallengeHistoryMechanic(private val rows: ChallengesByHouse) : GatewayMechanic(greeting = 710) {
    override fun part(made: Made): Part = ChallengeHistoryPart(made.core, rows)
}
