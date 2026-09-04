package villages.gateway

import villages.application.EventFeed
import villages.application.FoundHouseService
import villages.application.PlayerTokens
import villages.application.StoredEvent
import villages.domain.Banner
import villages.domain.HouseError
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.PlayerId
import villages.protocol.Charge
import villages.protocol.ClientFrame
import villages.protocol.Command
import villages.protocol.CommandAccepted
import villages.protocol.CommandRejected
import villages.protocol.Division
import villages.protocol.ErrorFrame
import villages.protocol.EventFrame
import villages.protocol.FoundHousePayload
import villages.protocol.Hello
import villages.protocol.PROTOCOL_VERSION
import villages.protocol.Ping
import villages.protocol.Pong
import villages.protocol.ProtocolJson
import villages.protocol.ServerFrame
import villages.protocol.SubscribeCells
import villages.protocol.Tincture
import villages.protocol.UnsubscribeCells
import villages.protocol.WatchEvents
import villages.protocol.Welcome
import java.time.Clock
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/** What the gateway needs to send a frame to a connection. The transport is Spring's; this is not. */
fun interface Outbound {
    fun send(frame: ServerFrame)
}

/**
 * The edge, without the transport: one instance per process, one `Connection` per socket. It speaks the
 * protocol, translates it to the application's terms and back, and fans the event feed out to every
 * connection that asked to watch. Nothing in here knows what a WebSocket is, so it is tested by calling it.
 */
class Gateway(
    private val tokens: PlayerTokens,
    private val foundHouse: FoundHouseService,
    events: EventFeed,
    private val clock: Clock,
) : AutoCloseable {
    private val watching = ConcurrentHashMap<Connection, Unit>()
    private val feed: AutoCloseable = events.subscribe { stored -> fanOut(stored) }

    fun connect(out: Outbound): Connection = Connection(out)

    private fun fanOut(stored: StoredEvent) {
        val frame = stored.toFrame()
        for (connection in watching.keys) {
            connection.out.send(frame)
        }
    }

    override fun close() {
        feed.close()
    }

    inner class Connection(internal val out: Outbound) {
        var player: PlayerId? = null
            private set

        fun receive(text: String) {
            val frame = try {
                ProtocolJson.decodeClient(text)
            } catch (unreadable: Exception) {
                out.send(ErrorFrame("unreadable", "not a frame this gateway speaks: ${unreadable.message}"))
                return
            }
            handle(frame)
        }

        private fun handle(frame: ClientFrame) {
            when (frame) {
                is Hello -> hello(frame)
                is Ping -> out.send(Pong(frame.t0, clock.millis()))
                is WatchEvents -> if (frame.on) watching[this] = Unit else watching.remove(this)
                is Command -> command(frame)
                is SubscribeCells, is UnsubscribeCells -> out.send(
                    ErrorFrame("notYet", "cells arrive with the projection; nothing to subscribe to until then"),
                )
            }
        }

        private fun hello(frame: Hello) {
            if (frame.protocolVersion != PROTOCOL_VERSION) {
                out.send(ErrorFrame("protocolVersion", "this gateway speaks version $PROTOCOL_VERSION"))
                return
            }
            val who = try {
                tokens.playerOf(frame.playerToken)
            } catch (bad: IllegalArgumentException) {
                out.send(ErrorFrame("playerToken", bad.message ?: "not a player token"))
                return
            }
            player = who
            out.send(Welcome(serverTime = clock.millis(), playerId = who.value.toString()))
        }

        private fun command(frame: Command) {
            val who = player
            if (who == null) {
                out.send(CommandRejected(frame.commandId, "notIntroduced"))
                return
            }
            try {
                when (val payload = frame.command) {
                    is FoundHousePayload -> foundHouse.found(
                        houseId = HouseId(UUID.fromString(payload.houseId)),
                        player = who,
                        name = HouseName.of(payload.name),
                        seat = Location(payload.seat.lat, payload.seat.lon),
                        banner = payload.banner.toDomain(),
                    )
                }
                out.send(CommandAccepted(frame.commandId))
            } catch (refused: HouseError) {
                out.send(CommandRejected(frame.commandId, refused.reasonCode()))
            } catch (malformed: IllegalArgumentException) {
                out.send(CommandRejected(frame.commandId, "malformed: ${malformed.message}"))
            }
        }

        fun disconnected() {
            watching.remove(this)
        }
    }
}

/** A domain refusal as the short code the protocol carries, which the interface turns into words. */
internal fun HouseError.reasonCode(): String = when (this) {
    HouseError.AlreadyFounded -> "alreadyFounded"
    is HouseError.InvalidName -> "invalidName"
    is HouseError.InvalidLocation -> "invalidLocation"
    is HouseError.InvalidBanner -> "invalidBanner"
}

internal fun StoredEvent.toFrame(): EventFrame = EventFrame(
    id = id,
    eventType = type,
    stream = stream,
    streamVersion = streamVersion,
    time = time.toEpochMilli(),
    data = ProtocolJson.tree(data),
)

/** The wire's heraldry, spelled for the interface, into the domain's. */
internal fun villages.protocol.BannerSpec.toDomain(): Banner = Banner(
    field = field.toDomain(),
    division = when (division) {
        Division.PLAIN -> villages.domain.Division.PLAIN
        Division.PER_PALE -> villages.domain.Division.PER_PALE
        Division.PER_FESS -> villages.domain.Division.PER_FESS
        Division.QUARTERLY -> villages.domain.Division.QUARTERLY
    },
    second = second?.toDomain(),
    charge = when (charge) {
        Charge.TOWER -> villages.domain.Charge.TOWER
        Charge.STAG -> villages.domain.Charge.STAG
        Charge.STAR -> villages.domain.Charge.STAR
    },
    chargeTincture = chargeTincture.toDomain(),
)

internal fun Tincture.toDomain(): villages.domain.Tincture = villages.domain.Tincture.valueOf(name)
