package villages.bots

import villages.protocol.ChoiceView
import villages.protocol.Command
import villages.protocol.CommandAccepted
import villages.protocol.CommandPayload
import villages.protocol.CommandRejected
import villages.protocol.ErrorFrame
import villages.protocol.Hello
import villages.protocol.PROTOCOL_VERSION
import villages.protocol.Point
import villages.protocol.ProtocolJson
import villages.protocol.Resync
import villages.protocol.RollPayload
import villages.protocol.Snapshot
import villages.protocol.SubscribeCells
import villages.protocol.TakeActionPayload
import villages.protocol.TakenOver
import villages.protocol.UnsubscribeCells
import villages.protocol.Welcome
import villages.protocol.WorldWiped
import villages.protocol.YourChoice
import villages.protocol.YourHouse
import java.util.UUID
import kotlin.random.Random

/** How often a bot does what a player does, in milliseconds, each wait drawn up to `jitter` either side. */
data class Pace(val panEvery: Long = 20_000, val rollEvery: Long = 60_000, val jitter: Double = 0.5)

/**
 * One simulated player, playing the player's own loop over the protocol and timing it: hello with a token of its
 * own, a seat taken from the choice it is offered, the cells round its seat followed, and then now and then a pan to
 * cells nearby and a roll, whose hand it plays. Everything a player would see go wrong is a failure in [trips].
 *
 * It does nothing by itself. A run hands it what the server says through [heard] and the passing of time through
 * [tick], from whatever threads it likes, one at a time.
 */
class Bot(
    private val wire: Wire,
    private val trips: RoundTrips,
    private val pace: Pace = Pace(),
    private val random: Random = Random.Default,
    private val now: () -> Long = System::currentTimeMillis,
    val token: String = UUID.randomUUID().toString(),
) {
    enum class Stage { GREETING, SEATING, PLAYING, GONE }

    @Volatile
    var stage: Stage = Stage.GREETING
        private set

    private var seat: Point? = null
    private var held: List<String> = emptyList()
    private var answered: String? = null
    private var nextPan = 0L
    private var nextRoll = 0L

    @Synchronized
    fun opened() {
        trips.started(Trip.WELCOME, token, now())
        // A bot plays as a player of its own, which only the instruments honour: a swarm measures a server that runs
        // them open, and a sign-in for each of ten thousand bots would measure the accounts instead of the game.
        say(ProtocolJson.encode(Hello(PROTOCOL_VERSION, playAs = token)))
    }

    @Synchronized
    fun heard(text: String) {
        val frame = try {
            ProtocolJson.decodeServer(text)
        } catch (@Suppress("TooGenericExceptionCaught") unreadable: Exception) {
            trips.failure("a frame it could not read: ${unreadable.javaClass.simpleName}")
            return
        }
        when (frame) {
            is Welcome -> {
                trips.finished(Trip.WELCOME, token, now())
                stage = Stage.SEATING
            }
            is YourChoice -> frame.choice?.let(::play)
            is YourHouse -> frame.yours?.let { if (seat == null) settle(it.house.seat) }
            is Snapshot -> trips.finished(Trip.SNAPSHOT, "$token ${frame.cell}", now())
            is CommandAccepted -> trips.finished(Trip.ACCEPTED, frame.commandId, now())
            is CommandRejected -> trips.failure("refused: ${frame.reason}")
            is ErrorFrame -> trips.failure("error ${frame.code}")
            is Resync -> follow(frame.cells)
            is TakenOver, is WorldWiped -> gone("told ${frame.javaClass.simpleName}")
            else -> Unit
        }
    }

    /** The bot's own clock: a pan or a roll when one is due, and nothing before it has a house. */
    @Synchronized
    fun tick() {
        if (stage != Stage.PLAYING) return
        val at = now()
        if (at >= nextPan) {
            pan()
            nextPan = at + wait(pace.panEvery)
        }
        if (at >= nextRoll) {
            // Its die dropped on its own seat, where it looked before the die. See 0118.
            command(RollPayload(landing = seat))
            nextRoll = at + wait(pace.rollEvery)
        }
    }

    @Synchronized
    fun gone(why: String) {
        if (stage == Stage.GONE) return
        stage = Stage.GONE
        trips.failure(why)
    }

    // The seat it is offered first, and every roll's hand after: a choice is answered once, with any of its options.
    private fun play(choice: ChoiceView) {
        if (choice.id == answered || choice.options.isEmpty()) return
        answered = choice.id
        command(TakeActionPayload(choice.id, choice.options.random(random).id))
    }

    private fun settle(at: Point) {
        seat = at
        stage = Stage.PLAYING
        follow(Neighbourhood.round(at))
        val start = now()
        nextPan = start + wait(pace.panEvery)
        nextRoll = start + wait(pace.rollEvery)
    }

    // Somewhere within a few cells of the seat, as a player looks about their own lands.
    private fun pan() {
        val home = seat ?: return
        val reach = 2 * 360.0 / (1 shl Neighbourhood.ZOOM)
        val there = Point(
            (home.lat + random.nextDouble(-reach, reach) / 2).coerceIn(-80.0, 80.0),
            home.lon + random.nextDouble(-reach, reach),
        )
        val wanted = Neighbourhood.round(there)
        val letGo = held - wanted.toSet()
        if (letGo.isNotEmpty()) say(ProtocolJson.encode(UnsubscribeCells(letGo)))
        follow(wanted - held.toSet(), keeping = held - letGo.toSet())
    }

    private fun follow(cells: List<String>, keeping: List<String> = held - cells.toSet()) {
        held = keeping + cells
        if (cells.isEmpty()) return
        val at = now()
        cells.forEach { trips.started(Trip.SNAPSHOT, "$token $it", at) }
        say(ProtocolJson.encode(SubscribeCells(cells)))
    }

    private fun command(payload: CommandPayload) {
        val id = UUID.randomUUID().toString()
        trips.started(Trip.ACCEPTED, id, now())
        say(ProtocolJson.encode(Command(id, payload)))
    }

    private fun say(text: String) {
        if (stage != Stage.GONE) wire.send(text)
    }

    private fun wait(every: Long): Long =
        if (pace.jitter == 0.0) every else (every * (1 + random.nextDouble(-pace.jitter, pace.jitter))).toLong()
}
