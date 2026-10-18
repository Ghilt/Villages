package villages.gateway

import villages.protocol.ConsideredView
import villages.protocol.NextRarityPayload
import villages.protocol.RollDrawn
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
import java.util.concurrent.ConcurrentHashMap

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
    private val open: Boolean,
) : Part {
    // What a roll drew from goes to the roller's own panel: the pools are never the player's to see, so it is said
    // only while the instruments are open.
    private val drawn: AutoCloseable = rolls.watch { player, rolled, forced ->
        if (open) {
            core.sessionOf(player)?.out?.send(
                RollDrawn(
                    opened = rolled.opened,
                    considered = rolled.considered.map { ConsideredView(it.action, it.weight) },
                    rarity = rolled.rarity.toWire(),
                    forced = forced,
                ),
            )
        }
    }

    private val asked: AutoCloseable = choices.watch { player, row ->
        core.sessionOf(player)?.let { tell(it, row?.choice?.toView(row.omens)) }
    }

    /**
     * Which choice a connection has been told of, and whether it has been told anything at all; the story each choice
     * it was handed began; and the world its page draws, from hello, whose ground a roll reads where it is looking.
     */
    private class Told {
        var choice: String? = null
        var ever = false
        val stories = ConcurrentHashMap<ChoiceId, UUID>()

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
        given?.let { connection.keptBy(this) { Told() }.stories[it.choice.id] = it.story }
        tell(connection, given?.choice?.toView() ?: choices.pendingOf(who)?.let { it.choice.toView(it.omens) })
    }

    override fun register(commands: Commands, frames: Frames) {
        // The world's luck, for the next roll this player makes: a rarity, or none for the throw again. See 0083.
        commands.lever<NextRarityPayload>(open) { asking, payload -> rolls.forceNext(asking.who, payload.rarity?.let(::asRarity)) }
        // A roll begins a story of its own, which the hand it deals and the action that answers it continue. The
        // hand it hands back is what goes out, as arrival's does, rather than a read of the projection.
        commands.on<RollPayload> { asking, payload ->
            val master = core.sessionOf(asking.who)?.keptBy(this) { Told() }?.master
            val rolled = rolls.roll(asking.who, payload.toLooking().copy(master = master), asking.startingAStory)
            core.sessionOf(asking.who)?.let {
                it.keptBy(this) { Told() }.stories[rolled.hand.id] = asking.startingAStory.correlationId
                tell(it, rolled.hand.toView(rolled.omens))
            }
        }
        commands.on<TakeActionPayload> { asking, payload ->
            val choice = ChoiceId(asUuid(payload.choiceId, "a choice id"))
            // An action continues the story the choice began, so the action and what it does wear the same
            // correlation as the question. The server decides this, not the client: nothing about correlation
            // crosses the wire. The story the window was handed with the choice comes first, and the read model
            // only after, because it is a moment behind and further when the broker carries the world (0035, 0094).
            val story = core.sessionOf(asking.who)?.keptBy(this) { Told() }?.stories?.get(choice)
                ?: pendingStory(asking.who)
                ?: asking.commandId
            takeAction.take(
                player = asking.who,
                choiceId = choice,
                optionId = OptionId(asUuid(payload.optionId, "an option id")),
                provenance = Provenance(asking.commandId, story),
            )
        }
    }

    private fun RollPayload.toLooking() = Looking(
        centre = centre?.let { Location(it.lat, it.lon) },
        zoom = zoom,
        inspectingHouses = inspectingHouses.map { HouseId(asUuid(it, "a house id")) },
        inspectingCharacters = inspectingCharacters.map { CharacterId(asUuid(it, "a character id")) },
        // A place off the Earth is no water, and is dropped as the fog drops what the house may not see.
        inspectingWaters = inspectingWaters.filter { it.lat in -90.0..90.0 && it.lon in -180.0..180.0 }
            .map { Location(it.lat, it.lon) },
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
        drawn.close()
        asked.close()
    }
}

/** The choices' place in the gateway: told last of what a house is, what it is asked; and the roll that deals it. */
class ChoicesMechanic(
    private val arrival: Arrival,
    private val takeAction: TakeActionService,
    private val choices: ChoicesByPlayer,
    private val rolls: RollService,
) : GatewayMechanic(greeting = 800) {
    override fun part(made: Made): Part = ChoicesPart(made.core, arrival, takeAction, choices, rolls, made.open)
}
