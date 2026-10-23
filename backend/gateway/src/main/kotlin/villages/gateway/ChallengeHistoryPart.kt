package villages.gateway

import villages.application.ChallengeReplays
import villages.application.ChallengeRow
import villages.application.ChallengesByHouse
import villages.application.Replay
import villages.domain.ChallengeId
import villages.domain.HouseId
import villages.domain.PlayerId
import villages.protocol.ChallengeRowView
import villages.protocol.ChallengeRun
import villages.protocol.ErrorFrame
import villages.protocol.OpponentView
import villages.protocol.SidesView
import villages.protocol.WatchChallenge
import villages.protocol.YourChallenges
import java.util.UUID

/**
 * A house's challenges: every one it fought reaches its player wherever they are looking, as its quests do, because
 * what a house fought is its own and needs no cell. Each window is told the whole history on hello, and again when it
 * changes; and a window that asks to watch one of them is sent it fought again, or `noSuchChallenge` for one its house
 * did not fight. See decision record 0107, amended.
 */
internal class ChallengeHistoryPart(
    private val core: Core,
    private val rows: ChallengesByHouse,
    private val replays: ChallengeReplays,
) : Part {
    private val changed: AutoCloseable = rows.watch { change ->
        core.sessionOf(change.player)?.let { tell(it, change.challenges) }
    }

    override fun greet(connection: Gateway.Connection, who: PlayerId) {
        tell(connection, rows.of(HouseId.of(who)))
    }

    override fun register(commands: Commands, frames: Frames) {
        frames.on<WatchChallenge> { connection, frame -> connection.out.send(watched(connection.player, frame.challengeId)) }
    }

    private fun watched(who: PlayerId?, challenge: String) =
        who?.let { player -> idOf(challenge)?.let { replays.replay(HouseId.of(player), it) } }?.toFrame()
            ?: ErrorFrame("noSuchChallenge", "the house fought no challenge $challenge")

    private fun idOf(text: String): ChallengeId? =
        try {
            ChallengeId(UUID.fromString(text))
        } catch (_: IllegalArgumentException) {
            null
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
    questId = questId.value.toString(),
    nodeId = nodeId.value,
    kind = kind,
    house = houseName,
    against = OpponentView(against.name, against.colour),
    brought = brought,
    outcome = outcome.toView(),
    foughtAt = foughtAt.toString(),
    then = then,
)

/**
 * A challenge fought again, to be watched: the recorded outcome with the fight's moments again, none when it could not
 * be fought again.
 */
internal fun Replay.toFrame(): ChallengeRun = ChallengeRun(
    id = row.id.value.toString(),
    sides = SidesView(row.setup.a.map { it.toView() }, row.setup.b.map { it.toView() }),
    progression = row.setup.progression.toView(),
    outcome = row.outcome.toView(),
    moments = again?.momentViews().orEmpty(),
    summons = again?.summonViews().orEmpty(),
    differs = differs,
)

/** The challenges' history's place in the gateway: told after the quests, which raised them, and watched again. */
class ChallengeHistoryMechanic(
    private val rows: ChallengesByHouse,
    private val replays: ChallengeReplays,
) : GatewayMechanic(greeting = 710) {
    override fun part(made: Made): Part = ChallengeHistoryPart(made.core, rows, replays)
}
