package villages.gateway

import villages.application.Arrival
import villages.application.ChoicesByPlayer
import villages.application.Provenance
import villages.application.TakeActionService
import villages.application.fate.Looking
import villages.application.fate.RollService
import villages.domain.CharacterId
import villages.domain.ChoiceId
import villages.domain.DialogueId
import villages.domain.HouseId
import villages.domain.Location
import villages.domain.OptionId
import villages.domain.PlayerId
import villages.protocol.ChoiceView
import villages.protocol.ErrorFrame
import villages.protocol.Hello
import villages.protocol.RollPayload
import villages.protocol.TakeActionPayload
import villages.protocol.YourChoice
import java.util.UUID

/**
 * What a player is asked: the choice pending on their house, which reaches them wherever they are looking, like
 * their house does; the founding choice given to a player who arrives with no house and nothing to decide; and
 * taking an option, and rolling for a hand with Take action, which are the player's own commands. See decision records
 * 0034, 0075 and 0083.
 */
internal class ChoicesPart(
    private val core: Core,
    private val arrival: Arrival,
    private val takeAction: TakeActionService,
    private val choices: ChoicesByPlayer,
    private val rolls: RollService,
) : Part {
    private val asked: AutoCloseable = choices.watch { player, row ->
        core.sessionOf(player)?.let { tell(it, row?.choice?.toView(row.omens)) }
    }

    /**
     * Which choice a connection has been told of, and whether it has been told anything at all; and the world its
     * page draws, from hello, whose ground a roll reads where it is looking.
     */
    private class Told {
        var choice: String? = null
        var ever = false

        @Volatile
        var master: String? = null
    }

    override fun arrive(connection: Gateway.Connection, hello: Hello, who: PlayerId) {
        connection.keptBy(this) { Told() }.master = hello.master
    }

    /**
     * Arriving with no house and nothing to decide is what the founding choice answers. The choice arrive()
     * hands back is what goes out, not a read of the projection: the projection folds on another thread and
     * would sometimes say "nothing" about a choice just written.
     */
    override fun greet(connection: Gateway.Connection, who: PlayerId) {
        val given = try {
            arrival.arrive(who)
        } catch (@Suppress("TooGenericExceptionCaught") wrong: RuntimeException) {
            connection.out.send(ErrorFrame("arrival", wrong.message ?: "could not be given a choice"))
            null
        }
        tell(connection, given?.toView() ?: choices.pendingOf(who)?.let { it.choice.toView(it.omens) })
    }

    override fun register(commands: Commands, frames: Frames) {
        // A roll begins a story of its own, which the hand it deals and the action that answers it continue. The
        // hand it hands back is what goes out, as arrival's does, rather than a read of the projection.
        commands.on<RollPayload> { asking, payload ->
            val master = core.sessionOf(asking.who)?.keptBy(this) { Told() }?.master
            val rolled = rolls.roll(asking.who, payload.toLooking().copy(master = master), asking.startingAStory)
            core.sessionOf(asking.who)?.let { tell(it, rolled.hand.toView(rolled.omens)) }
        }
        commands.on<TakeActionPayload> { asking, payload ->
            takeAction.take(
                player = asking.who,
                choiceId = ChoiceId(asUuid(payload.choiceId, "a choice id")),
                optionId = OptionId(asUuid(payload.optionId, "an option id")),
                // An action continues the story the choice began, so the action and what it does wear the same
                // correlation as the question. The server decides this, not the client: nothing about
                // correlation crosses the wire. See decision record 0035.
                provenance = Provenance(asking.commandId, pendingStory(asking.who) ?: asking.commandId),
            )
        }
    }

    private fun RollPayload.toLooking() = Looking(
        centre = centre?.let { Location(it.lat, it.lon) },
        zoom = zoom,
        inspectingHouses = inspectingHouses.map { HouseId(asUuid(it, "a house id")) },
        inspectingCharacters = inspectingCharacters.map { CharacterId(asUuid(it, "a character id")) },
        dialogue = dialogue?.let { DialogueId(asUuid(it, "a dialogue id")) },
        figure = figure?.let { CharacterId(asUuid(it, "a character id")) },
    )

    /** The story the pending choice began, so an action answering it belongs to that story. */
    private fun pendingStory(who: PlayerId): UUID? =
        choices.pendingOf(who)?.let { row -> runCatching { UUID.fromString(row.correlationId) }.getOrNull() }

    /**
     * Says what this player has to decide, unless they have already been told of that same choice.
     *
     * Two paths lead here and either may run first: the hello that gave the choice, and the watch on
     * the read model that folded it. Without the guard a player would be told the same thing twice on
     * arriving. The first call always sends, even with nothing pending, so the answer to hello is
     * definite in the way `yourHouse` is.
     */
    private fun tell(connection: Gateway.Connection, choice: ChoiceView?) {
        val told = connection.keptBy(this) { Told() }
        synchronized(told) {
            if (connection.isFinished || (told.ever && choice?.id == told.choice)) {
                return
            }
            told.ever = true
            told.choice = choice?.id
        }
        connection.out.send(YourChoice(choice))
    }

    override fun close() {
        asked.close()
    }
}
