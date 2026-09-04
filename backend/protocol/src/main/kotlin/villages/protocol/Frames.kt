package villages.protocol

import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.annotation.JsonProperty
import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo

/**
 * The frames that cross the WebSocket, as JSON text with a `type` field naming each. Mirrored in
 * TypeScript under frontend/packages/protocol, and both sides are tested against the same fixtures in
 * contracts/fixtures/frames, which own the format.
 *
 * Nothing here is a domain type. Tinctures are strings the browser can show, times are the server's
 * clock in milliseconds since the epoch, identifiers are strings. The gateway translates.
 */

/** The version both ends declare in the handshake, so the gateway can refuse a client it cannot speak to. */
const val PROTOCOL_VERSION = 1

data class Point(val lat: Double, val lon: Double)

enum class Tincture {
    @JsonProperty("or") OR,
    @JsonProperty("argent") ARGENT,
    @JsonProperty("gules") GULES,
    @JsonProperty("azure") AZURE,
    @JsonProperty("sable") SABLE,
    @JsonProperty("vert") VERT,
    @JsonProperty("purpure") PURPURE,
}

enum class Division {
    @JsonProperty("plain") PLAIN,
    @JsonProperty("perPale") PER_PALE,
    @JsonProperty("perFess") PER_FESS,
    @JsonProperty("quarterly") QUARTERLY,
}

enum class Charge {
    @JsonProperty("tower") TOWER,
    @JsonProperty("stag") STAG,
    @JsonProperty("star") STAR,
}

/** A banner as the browser draws it. `second` is absent for a plain field. */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class BannerSpec(
    val field: Tincture,
    val division: Division,
    val second: Tincture? = null,
    val charge: Charge,
    val chargeTincture: Tincture,
)

/** A resource as a rate: the amount at `asOf`, server milliseconds, and how fast it grows. Clients interpolate. */
data class Rate(val amount: Long, val ratePerSecond: Double, val asOf: Long)

/** A house as the map shows it. `version` is the stream version, so snapshots and deltas can be ordered. */
data class HouseView(
    val id: String,
    val name: String,
    val cell: String,
    val seat: Point,
    val banner: BannerSpec,
    val treasury: Rate,
    val version: Long,
)

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes(
    JsonSubTypes.Type(Hello::class, name = "hello"),
    JsonSubTypes.Type(SubscribeCells::class, name = "subscribeCells"),
    JsonSubTypes.Type(UnsubscribeCells::class, name = "unsubscribeCells"),
    JsonSubTypes.Type(Command::class, name = "command"),
    JsonSubTypes.Type(Ping::class, name = "ping"),
)
sealed interface ClientFrame

data class Hello(val playerToken: String, val protocolVersion: Int) : ClientFrame

data class SubscribeCells(val cells: List<String>) : ClientFrame

data class UnsubscribeCells(val cells: List<String>) : ClientFrame

/** A command with a client-chosen id, so the answer can be matched to it. */
data class Command(val commandId: String, val command: CommandPayload) : ClientFrame

data class Ping(val t0: Long) : ClientFrame

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes(
    JsonSubTypes.Type(FoundHousePayload::class, name = "foundHouse"),
)
sealed interface CommandPayload

/** The player is whoever holds the session; the instant is the server's. Neither is on the wire. */
data class FoundHousePayload(val houseId: String, val name: String, val seat: Point, val banner: BannerSpec) : CommandPayload

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes(
    JsonSubTypes.Type(Welcome::class, name = "welcome"),
    JsonSubTypes.Type(Snapshot::class, name = "snapshot"),
    JsonSubTypes.Type(Batch::class, name = "batch"),
    JsonSubTypes.Type(CommandAccepted::class, name = "commandAccepted"),
    JsonSubTypes.Type(CommandRejected::class, name = "commandRejected"),
    JsonSubTypes.Type(Resync::class, name = "resync"),
    JsonSubTypes.Type(Pong::class, name = "pong"),
    JsonSubTypes.Type(ErrorFrame::class, name = "error"),
)
sealed interface ServerFrame

/** The answer to hello. `ownHouse` is absent for a player who has not founded one. */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class Welcome(val serverTime: Long, val playerId: String, val ownHouse: HouseView? = null) : ServerFrame

/** Everything in a cell, sent on subscribing to it, before any deltas. */
data class Snapshot(val cell: String, val houses: List<HouseView>, val asOfVersion: Long) : ServerFrame

/** Deltas coalesced over a short window into one frame. */
data class Batch(val deltas: List<Delta>) : ServerFrame

data class CommandAccepted(val commandId: String) : ServerFrame

data class CommandRejected(val commandId: String, val reason: String) : ServerFrame

/** The client fell too far behind and must ask for these cells again. */
data class Resync(val cells: List<String>) : ServerFrame

data class Pong(val t0: Long, val serverTime: Long) : ServerFrame

data class ErrorFrame(val code: String, val message: String) : ServerFrame

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes(
    JsonSubTypes.Type(HouseAppeared::class, name = "houseAppeared"),
    JsonSubTypes.Type(HouseChanged::class, name = "houseChanged"),
)
sealed interface Delta

data class HouseAppeared(val house: HouseView) : Delta

data class HouseChanged(val house: HouseView) : Delta
