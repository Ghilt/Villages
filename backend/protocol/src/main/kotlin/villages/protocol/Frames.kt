package villages.protocol

import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.annotation.JsonProperty
import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo
import tools.jackson.databind.JsonNode

/**
 * The frames that cross the WebSocket, as JSON text with a `type` field naming each. Mirrored in
 * TypeScript under frontend/packages/protocol, and both sides are tested against the same fixtures in
 * contracts/fixtures/frames, which own the format.
 *
 * Nothing here is a domain type. Tinctures are strings the browser can show, times are the server's
 * clock in milliseconds since the epoch, identifiers are strings. The gateway translates.
 */

/**
 * The version both ends declare in the handshake, so the gateway can refuse a client it cannot speak to.
 *
 * It goes up whenever a frame or a field below changes, and `ProtocolShapeSpec` is what makes sure of
 * that: the shape of every frame is recorded in contracts/protocol-v<n>.txt, and a wire that has moved
 * without a new number is a failing build. Version 2 is the first gameplay loop, which added
 * `takeAction`, `yourChoice`, `wipeWorld` and `worldWiped`, and gave every event its provenance.
 * Version 3 added `seeAll`, the eye that sets significance aside.
 */
const val PROTOCOL_VERSION = 5

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

/**
 * How much of one resource a house has: the total at `asOf` in server milliseconds, how fast it grows, and
 * how much of it is spoken for. Clients interpolate the total and subtract the pledged to get what is free.
 *
 * `pledged` is worked out by the gateway from the house's live pledges and is not stored anywhere as a
 * number; it is on the wire so that the browser does not have to sum a list to draw one figure.
 */
data class Stock(val total: Long, val pledged: Long, val ratePerSecond: Double, val asOf: Long)

/** One live pledge, so the player can see what their reason is tied up in and until when. */
data class PledgeView(
    val id: String,
    val resource: String,
    val amount: Long,
    /** The world-day it comes back on, as a count the calendar reads. */
    val until: Long,
    val purpose: String,
)

/**
 * A house as the map shows it. `since` is the world-day it exists from, as a count the calendar reads;
 * `version` is the stream version, so snapshots and deltas can be ordered.
 */
data class HouseView(
    val id: String,
    val name: String,
    val cell: String,
    val seat: Point,
    val banner: BannerSpec,
    val since: Long,
    val version: Long,
)

/**
 * The player's own house: everything anybody can see of it, and what only its owner can.
 *
 * **What a house has is private.** A `HouseView` goes to everyone holding the cell, up to two hundred at a
 * time, so putting five stocks on it would both tell the neighbours a house's business and multiply what a
 * snapshot weighs. Resources reach one session, the owner's, and the structure is what enforces that
 * rather than a convention anybody has to remember.
 *
 * The keys of `resources` are the wire's names for the five, which are the code's names and not the
 * player's: `naturalDomain` is shown as Domain. See the naming rule in `BUILDING-A-MECHANIC.md`.
 */
data class YourHouseView(
    val house: HouseView,
    val resources: Map<String, Stock>,
    val pledges: List<PledgeView>,
)

/** Where the world's clock stands: today's world-day, and the earliest day anything is known to exist from. */
data class WorldNow(val today: Long, val earliest: Long)

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes(
    JsonSubTypes.Type(Hello::class, name = "hello"),
    JsonSubTypes.Type(SubscribeCells::class, name = "subscribeCells"),
    JsonSubTypes.Type(UnsubscribeCells::class, name = "unsubscribeCells"),
    JsonSubTypes.Type(Command::class, name = "command"),
    JsonSubTypes.Type(Ping::class, name = "ping"),
    JsonSubTypes.Type(WatchEvents::class, name = "watchEvents"),
    JsonSubTypes.Type(ViewTime::class, name = "viewTime"),
    JsonSubTypes.Type(SeeAll::class, name = "seeAll"),
    JsonSubTypes.Type(WipeWorld::class, name = "wipeWorld"),
)
sealed interface ClientFrame

data class Hello(val playerToken: String, val protocolVersion: Int) : ClientFrame

data class SubscribeCells(val cells: List<String>) : ClientFrame

data class UnsubscribeCells(val cells: List<String>) : ClientFrame

/**
 * A command with a client-chosen id, so the answer can be matched to it.
 *
 * The id is a UUID, and the gateway refuses anything else: it becomes the causation id of every event the
 * command writes, and an identity a consumer can rely on has to be one. See decision record 0035.
 */
data class Command(val commandId: String, val command: CommandPayload) : ClientFrame

data class Ping(val t0: Long) : ClientFrame

/**
 * Asks for every stored event as it is stored, or stops asking. This is how the debug panel sees the
 * world happen; a player's interface never sends it. See decision record 0023.
 */
data class WatchEvents(val on: Boolean) : ClientFrame

/**
 * Looks at the world as it was on a world-day, or at live when `at` is null. Every held cell is answered
 * with a fresh snapshot as of that day, and from then on only changes that exist on it are sent. This is
 * the timeline scrubber's one frame.
 */
data class ViewTime(val at: Long?) : ClientFrame

/**
 * Sets significance aside, so that every house in a held cell is sent however far back the camera is,
 * rather than only the ones significant enough for the cell's zoom. The eye's one frame.
 *
 * Like `viewTime`, which it is modelled on: it changes what the connection is shown rather than what it
 * holds, so every held cell is answered again as soon as it is sent. See decision record 0038.
 */
data class SeeAll(val on: Boolean) : ClientFrame

/**
 * Empties the development world, for everyone. A debug frame, like `watchEvents`, and not one a player's
 * interface ever sends. It goes, or gains a guard, before there is anything worth keeping. See 0036.
 */
class WipeWorld : ClientFrame {
    override fun equals(other: Any?): Boolean = other is WipeWorld

    override fun hashCode(): Int = javaClass.hashCode()

    override fun toString(): String = "WipeWorld"
}

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes(
    JsonSubTypes.Type(FoundHousePayload::class, name = "foundHouse"),
    JsonSubTypes.Type(GrantResourcePayload::class, name = "grantResource"),
    JsonSubTypes.Type(PledgeResourcePayload::class, name = "pledgeResource"),
    JsonSubTypes.Type(ReleasePledgePayload::class, name = "releasePledge"),
    JsonSubTypes.Type(SpendResourcePayload::class, name = "spendResource"),
    JsonSubTypes.Type(TakeActionPayload::class, name = "takeAction"),
)
sealed interface CommandPayload

/**
 * The player is whoever holds the session, the instant is the server's, and the house's identity is worked
 * out from the player. None of the three is on the wire: a client naming its own stream could name one
 * that is not its own. See decision record 0028.
 */
data class FoundHousePayload(val name: String, val seat: Point, val banner: BannerSpec) : CommandPayload

/**
 * Give this house some of a resource, or use some of it up.
 *
 * Which house is worked out from the session, like everything else: a client naming a stream could name
 * one that is not its own. `resource` is a wire name, so `naturalDomain` and not Domain.
 *
 * **These two are Adam's levers rather than a player's.** Nothing in the game gives a house wealth yet,
 * and nothing spends it; the commands exist so that what the domain can do can be made to happen on
 * purpose and watched. When a mechanic grants or spends, it will do so through the same commands.
 */
data class GrantResourcePayload(val resource: String, val amount: Long) : CommandPayload

data class SpendResourcePayload(val resource: String, val amount: Long) : CommandPayload

/**
 * Tie some of a resource to an undertaking for a span of months.
 *
 * The span is in months and the world-day it ends on is worked out by the server, because how long a
 * month is belongs to the calendar and not to whoever is asking. See decision record 0051.
 */
data class PledgeResourcePayload(
    val resource: String,
    val amount: Long,
    val months: Long,
    val purpose: String,
) : CommandPayload

/** End a pledge and let what it holds come back, whether its span is up or not. */
data class ReleasePledgePayload(val pledgeId: String) : CommandPayload

/**
 * Take one option of the choice this player has pending. It names the choice as well as the option, so a
 * parchment left open while the world moved on is refused rather than answering something else.
 *
 * Which story this continues is not on the wire: the server reads it from the choice. See 0034 and 0035.
 */
data class TakeActionPayload(val choiceId: String, val optionId: String) : CommandPayload

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
    JsonSubTypes.Type(EventFrame::class, name = "event"),
    JsonSubTypes.Type(YourHouse::class, name = "yourHouse"),
    JsonSubTypes.Type(YourChoice::class, name = "yourChoice"),
    JsonSubTypes.Type(TakenOver::class, name = "takenOver"),
    JsonSubTypes.Type(WorldWiped::class, name = "worldWiped"),
)
sealed interface ServerFrame

/** The answer to hello, carrying where the world's clock stands. The player's own house follows in `yourHouse`. */
data class Welcome(val serverTime: Long, val playerId: String, val world: WorldNow) : ServerFrame

/**
 * What a cell holds, sent on subscribing to it, before any deltas. `omitted` is how many more houses the
 * cell had than a snapshot carries, so a screen never claims to show all of what it shows most of.
 */
data class Snapshot(
    val cell: String,
    val houses: List<HouseView>,
    val asOfVersion: Long,
    @get:JsonInclude(JsonInclude.Include.NON_DEFAULT) val omitted: Int = 0,
) : ServerFrame

/** Deltas coalesced over a short window into one frame. */
data class Batch(val deltas: List<Delta>) : ServerFrame

data class CommandAccepted(val commandId: String) : ServerFrame

data class CommandRejected(val commandId: String, val reason: String) : ServerFrame

/** The client fell too far behind and must ask for these cells again. */
data class Resync(val cells: List<String>) : ServerFrame

data class Pong(val t0: Long, val serverTime: Long) : ServerFrame

data class ErrorFrame(val code: String, val message: String) : ServerFrame

/**
 * The player's own house, wherever they are looking. Sent after welcome, with null when they have none so
 * that the answer is definite, and again whenever it appears or changes.
 */
data class YourHouse(val yours: YourHouseView?) : ServerFrame

/**
 * Another window took this player over, and this session is finished: it holds no cells, hears nothing
 * more and accepts no commands. A player plays from one place. See decision record 0028.
 */
data class TakenOver(val message: String) : ServerFrame

/**
 * What this player has to decide, or null when they have nothing. Sent after welcome and again whenever
 * it changes, like `yourHouse`: what is pending is the player's, not the session's. See 0028 and 0034.
 */
data class YourChoice(val choice: ChoiceView?) : ServerFrame

/**
 * The world was emptied and this session is finished with it: it holds no cells, hears nothing more and
 * accepts nothing more. Every session is told, because a wipe is everybody's. See decision record 0036.
 */
data class WorldWiped(val message: String) : ServerFrame

/**
 * A choice as the parchment shows it: what is being asked, and the two to four things that could be done
 * about it. The interface renders this and nothing else, so a new kind of choice needs no new frame.
 */
data class ChoiceView(val id: String, val prompt: String, val options: List<OptionView>)

data class OptionView(val id: String, val label: String, val detail: String, val effect: EffectView)

/** What taking an option would do. `kind` names the case, as it does in the store. See 0034. */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "kind")
@JsonSubTypes(
    JsonSubTypes.Type(FoundAtView::class, name = "foundAt"),
)
sealed interface EffectView

data class FoundAtView(val seat: Point, val name: String, val banner: BannerSpec) : EffectView

/**
 * One stored event, as stored: the envelope and the data, for a client that asked to watch. `eventType` is
 * the catalogued CloudEvent type, `time` the server's clock in milliseconds, `data` the event's own fields.
 * Generic on purpose: it carries any event the catalogue ever lists.
 *
 * `id` is the event's own identity; `correlationId` the story it belongs to, which everything following
 * from one command shares; `causationId` what directly caused it, which for an event from a command is
 * that command's id. See decision record 0035.
 */
data class EventFrame(
    val id: String,
    val eventType: String,
    val stream: String,
    val streamVersion: Long,
    val time: Long,
    val correlationId: String,
    val causationId: String,
    val data: JsonNode,
) : ServerFrame

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes(
    JsonSubTypes.Type(HouseAppeared::class, name = "houseAppeared"),
    JsonSubTypes.Type(HouseChanged::class, name = "houseChanged"),
)
sealed interface Delta

data class HouseAppeared(val house: HouseView) : Delta

data class HouseChanged(val house: HouseView) : Delta
