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
 * It goes up whenever a frame or a field changes, and `ProtocolShapeSpec` makes sure of that: every frame's shape
 * is recorded in contracts/protocol-v<n>.txt, and what each version changed is in contracts/README.md.
 */
const val PROTOCOL_VERSION = 34

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
 * A house as the map shows it. `since` is the world-day it exists from; `version` the stream version, so snapshots and
 * deltas can be ordered; `seenUntil` the day the fog hid it from the house it is sent to. See decision 0089.
 */
data class HouseView(
    val id: String,
    val name: String,
    val cell: String,
    val seat: Point,
    val banner: BannerSpec,
    val since: Long,
    val version: Long,
    @get:JsonInclude(JsonInclude.Include.NON_NULL) val seenUntil: Long? = null,
)

/**
 * The player's own house: everything anybody can see of it, and what only its owner can.
 *
 * **What a house has is private.** A `HouseView` goes to everyone holding the cell, up to two hundred at a time,
 * so putting five stocks on it would both tell the neighbours a house's business and multiply what a snapshot
 * weighs. Resources reach one session, the owner's, and the structure enforces that rather than a convention.
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
    JsonSubTypes.Type(FogOfWar::class, name = "fogOfWar"),
    JsonSubTypes.Type(WipeWorld::class, name = "wipeWorld"),
    JsonSubTypes.Type(InspectAt::class, name = "inspectAt"),
    JsonSubTypes.Type(Inspect::class, name = "inspect"),
)
sealed interface ClientFrame

/**
 * Who is playing, and which wire they speak. `master` is the world the page draws, by its name in the Debug map
 * section, so that the gateway sends that world's stands; left out, it sends none. The gateway checks it against
 * the masters it has stands for rather than trusting it as a name. See decision records 0025 and 0067.
 */
data class Hello(
    val playerToken: String,
    val protocolVersion: Int,
    @get:JsonInclude(JsonInclude.Include.NON_NULL) val master: String? = null,
) : ClientFrame

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
 * Lifts the fog of war for this connection, or lets it fall again: with it lifted the gateway sends what the
 * house cannot see as well as what it can. On unless this says otherwise, so a connection that never sends it
 * is held to its house's sight.
 *
 * Adam's switch and a debug frame, like `wipeWorld`: a player's interface has no business lifting its own
 * fog, and this goes, or gains a guard, before there is anything worth hiding. Like `seeAll`, every held cell
 * is answered again as soon as it is sent. See decision record 0061.
 */
data class FogOfWar(val on: Boolean) : ClientFrame

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
    JsonSubTypes.Type(YourKeyFigures::class, name = "yourKeyFigures"),
    JsonSubTypes.Type(YourSight::class, name = "yourSight"),
    JsonSubTypes.Type(YourDialogues::class, name = "yourDialogues"),
    JsonSubTypes.Type(TakenOver::class, name = "takenOver"),
    JsonSubTypes.Type(WorldWiped::class, name = "worldWiped"),
    JsonSubTypes.Type(StandsFrame::class, name = "stands"),
    JsonSubTypes.Type(RollDrawn::class, name = "rollDrawn"),
    JsonSubTypes.Type(Inspected::class, name = "inspected"),
    JsonSubTypes.Type(InspectedAt::class, name = "inspectedAt"),
)
sealed interface ServerFrame

/** The answer to hello: where the world's clock stands, and where the world is kept while the instruments are open. */
data class Welcome(val serverTime: Long, val playerId: String, val world: WorldNow, val keptIn: String? = null) : ServerFrame

/**
 * What a cell holds, sent on subscribing to it, before any deltas. `omitted` is how many more houses the cell had
 * than a snapshot carries, so a screen never claims to show all of what it shows most of, and `omittedCharacters`
 * the same for the characters standing in it. A cell with nobody standing in it carries no `characters` at all.
 */
data class Snapshot(
    val cell: String,
    val houses: List<HouseView>,
    val asOfVersion: Long,
    @get:JsonInclude(JsonInclude.Include.NON_DEFAULT) val omitted: Int = 0,
    @get:JsonInclude(JsonInclude.Include.NON_EMPTY) val characters: List<CharacterOnMapView> = emptyList(),
    @get:JsonInclude(JsonInclude.Include.NON_DEFAULT) val omittedCharacters: Int = 0,
) : ServerFrame

/**
 * The stands of the scenery in one zoom 7 tile, `x` across and `y` down, that touch ground the house has
 * revealed: the sprite map's own records, eight bytes each, in base64, which `StandRecords` reads. Sent for
 * every tile under a held cell from zoom 6 in, once while a held cell stays over it, and again when the
 * house's sight or the fog switch changes what it lets through; empty when nothing there does. What the fog
 * holds back is simply not in it, and nothing says how much. See decision records 0054 and 0067.
 */
data class StandsFrame(val x: Int, val y: Int, val stands: String) : ServerFrame

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
 * The player's key figures, in the order their house took them in, wherever they are looking. Sent after
 * `yourHouse` on hello, always a list and empty when there are none, and again whenever one is taken in or
 * lost or changes in their own record. What a house holds is its own, like what it has. See decision 0055.
 */
data class YourKeyFigures(val keyFigures: List<KeyFigureView>) : ServerFrame

/**
 * Every vision point the player's house has had, oldest first, wherever they are looking. Sent after
 * `yourKeyFigures` on hello, always a list and empty while there is no house, and again whenever one opens
 * or closes. Its **vision** is the points lasting today, what it has **revealed** is everything any of them
 * has ever covered, and the rest of the world is **unknown**: the fog of war is drawn from this. What a
 * house sees is its own, like what it holds. See decision record 0061.
 *
 * `tension` is the surface tension of the edge, in kilometres: vision and revealed ground are their circles
 * and every gap or notch between them a ball this big cannot get into, which is `Coverage`. It is sent rather
 * than known at both ends so that the server stays the one place a sight is worked out. See 0064.
 */
data class YourSight(val points: List<VisionPointView>, val tension: Double) : ServerFrame

/**
 * Somewhere the house sees from. `kind` says what gives it - `seat`, `keyFigure` or `given` - and `of` is the
 * key figure's id or the given vision's, absent for the seat. `radius` is how far it sees around `place`, in **kilometres** on the
 * ground: how big that is on the map is worked out at the place's latitude, where Mercator draws the circle
 * round. `since` and `until` are world-days; `until` is absent while it still gives vision.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class VisionPointView(
    val kind: String,
    val of: String? = null,
    val place: Point,
    val radius: Double,
    val since: Long,
    val until: Long? = null,
)

/**
 * The world was emptied and this session is finished with it: it holds no cells, hears nothing more and
 * accepts nothing more. Every session is told, because a wipe is everybody's. See decision record 0036.
 */
data class WorldWiped(val message: String) : ServerFrame

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
