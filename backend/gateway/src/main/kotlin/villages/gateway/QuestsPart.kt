package villages.gateway

import villages.application.Provenance
import villages.application.ChallengeService
import villages.application.QuestRow
import villages.application.QuestService
import villages.application.QuestsByHouse
import villages.domain.HouseId
import villages.domain.NodeId
import villages.domain.ObjectiveId
import villages.domain.PlayerId
import villages.domain.QuestId
import villages.protocol.AcceptChallengePayload
import villages.protocol.CollectRewardPayload
import villages.protocol.MeetObjectivePayload
import villages.protocol.YourQuests
import java.util.UUID

/**
 * A house's quests: they reach its player wherever they are looking, as its dialogues do, because what a house set
 * out to do is its own and needs no cell; and meeting an objective, collecting a reward or accepting a challenge is
 * the player's own command. Each window is sent what the walk draws of them, and nothing behind a question mark. Offering one is
 * Adam's lever, registered here and refused with the rest of the instruments when they are closed (0076). See decision
 * records 0075 and 0096.
 */
internal class QuestsPart(
    private val core: Core,
    private val open: Boolean,
    private val quests: QuestService,
    private val rows: QuestsByHouse,
    private val challenges: ChallengeService,
) : Part {
    private val changed: AutoCloseable = rows.watch { change ->
        core.sessionOf(change.player)?.let { tell(it, change.quests) }
    }

    override fun greet(connection: Gateway.Connection, who: PlayerId) {
        tell(connection, rows.of(HouseId.of(who)))
    }

    override fun register(commands: Commands, frames: Frames) {
        questLevers(commands, open, quests)
        // A move in a quest continues the story the offer began, as a step continues its dialogue's, so the tick, what
        // it costs and the move on wear the offer's correlation. The server decides this, not the client.
        commands.on<MeetObjectivePayload> { asking, payload ->
            val quest = QuestId(asUuid(payload.questId, "a quest id"))
            quests.meet(
                player = asking.who,
                quest = quest,
                node = NodeId(payload.nodeId),
                objective = ObjectiveId(payload.objectiveId),
                provenance = Provenance(asking.commandId, storyOf(asking.who, quest) ?: asking.commandId),
            )
        }
        commands.on<AcceptChallengePayload> { asking, payload ->
            val quest = QuestId(asUuid(payload.questId, "a quest id"))
            challenges.accept(
                player = asking.who,
                quest = quest,
                node = NodeId(payload.nodeId),
                brought = payload.slices,
                provenance = Provenance(asking.commandId, storyOf(asking.who, quest) ?: asking.commandId),
            )
        }
        commands.on<CollectRewardPayload> { asking, payload ->
            val quest = QuestId(asUuid(payload.questId, "a quest id"))
            quests.collect(
                player = asking.who,
                quest = quest,
                node = NodeId(payload.nodeId),
                provenance = Provenance(asking.commandId, storyOf(asking.who, quest) ?: asking.commandId),
            )
        }
    }

    /** The story a quest was offered in, so a move in it belongs to that story. */
    private fun storyOf(who: PlayerId, quest: QuestId): UUID? =
        rows.of(HouseId.of(who)).firstOrNull { it.quest.id == quest }
            ?.let { row -> runCatching { UUID.fromString(row.correlationId) }.getOrNull() }

    private fun tell(connection: Gateway.Connection, quests: List<QuestRow>) {
        connection.out.send(YourQuests(quests.map { it.toView() }))
    }

    override fun close() {
        changed.close()
    }
}

/** The quests' place in the gateway: told after what a house was told, and before what it is asked. */
class QuestsMechanic(
    private val quests: QuestService,
    private val rows: QuestsByHouse,
    private val challenges: ChallengeService,
) : GatewayMechanic(greeting = 700) {
    override fun part(made: Made): Part = QuestsPart(made.core, made.open, quests, rows, challenges)
}
