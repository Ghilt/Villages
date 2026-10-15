package villages.gateway

import villages.application.QuestRow
import villages.application.QuestsByHouse
import villages.domain.HouseId
import villages.domain.PlayerId
import villages.protocol.YourQuests

/**
 * A house's quests: they reach its player wherever they are looking, as its dialogues do, because what a house set
 * out to do is its own and needs no cell. Each window is sent what the walk draws of them, and nothing behind a
 * question mark. Offering one is a lever, and the instruments'. See decision records 0075 and 0096.
 */
internal class QuestsPart(
    private val core: Core,
    private val rows: QuestsByHouse,
) : Part {
    private val changed: AutoCloseable = rows.watch { change ->
        core.sessionOf(change.player)?.let { tell(it, change.quests) }
    }

    override fun greet(connection: Gateway.Connection, who: PlayerId) {
        tell(connection, rows.of(HouseId.of(who)))
    }

    override fun register(commands: Commands, frames: Frames) = Unit

    private fun tell(connection: Gateway.Connection, quests: List<QuestRow>) {
        connection.out.send(YourQuests(quests.map { it.toView() }))
    }

    override fun close() {
        changed.close()
    }
}
