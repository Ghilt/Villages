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
 * without a new number is a failing build. What each version changed is in contracts/README.md.
 */
const val PROTOCOL_VERSION = 24

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

/** A house holding a character as a key figure, named the way a view of the tie needs it. */
data class HolderView(val id: String, val name: String, val banner: BannerSpec)

/**
 * A character's four stats, each a whole number from one to twenty. On the owner's view of a key figure and
 * nowhere else: what another house's people are like is that house's to know. See decision record 0055.
 */
data class StatsView(val piety: Int, val reason: Int, val kindness: Int, val physical: Int)

/**
 * One of the player's key figures, as the pane shows them.
 *
 * Their age is not on the wire. It is the completed months from `bornOn` to today, over twelve, plus
 * `agedYears`, and the browser has the calendar to work it out and the day to work it out on. `version` is
 * the read model's revision, so that of two copies of one figure the newer wins.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class KeyFigureView(
    val id: String,
    val givenName: String,
    val familyName: String,
    /** `woman` or `man`. */
    val sex: String,
    /** `person`, and nothing else yet. */
    val species: String,
    val bornOn: Long,
    val agedYears: Int,
    val stats: StatsView,
    /** The portrait's key, the file's name in `world/portraits/` without its `.png`; absent for none. */
    val portrait: String? = null,
    /** Every house holding them, in the order they were taken in: the first is whose colours they wear. */
    val keyFigureOf: List<HolderView>,
    /** Where they stand on the map today; absent while they are on none. */
    val place: Point? = null,
    val version: Long,
)

/**
 * A character standing on the map, as everyone holding the cell sees them.
 *
 * Less than a key figure's view on purpose: a stranger sees who somebody is, how old, whose they are and
 * where they stand, and not their stats, which are the house's own. The age is not on the wire, for the
 * reason it is not on a key figure's: it is counted from `bornOn` and `agedYears` on the day it is read.
 * `cell` is the deepest cell the place falls in, as a house's is; `since` is the world-day they came to
 * stand there; `version` is the read model's revision, so of two copies the newer wins. See 0055.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class CharacterOnMapView(
    val id: String,
    val givenName: String,
    val familyName: String,
    val sex: String,
    val species: String,
    val bornOn: Long,
    val agedYears: Int,
    val portrait: String? = null,
    val place: Point,
    val cell: String,
    /** Every house holding them, in the order they were taken in: the first is whose colours they wear. */
    val keyFigureOf: List<HolderView>,
    val since: Long,
    val version: Long,
)

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
    JsonSubTypes.Type(AddKeyFigurePayload::class, name = "addKeyFigure"),
    JsonSubTypes.Type(AgeCharacterPayload::class, name = "ageCharacter"),
    JsonSubTypes.Type(ChangePortraitPayload::class, name = "changePortrait"),
    JsonSubTypes.Type(ChangeStatPayload::class, name = "changeStat"),
    JsonSubTypes.Type(FoundHousePayload::class, name = "foundHouse"),
    JsonSubTypes.Type(GrantResourcePayload::class, name = "grantResource"),
    JsonSubTypes.Type(KillCharacterPayload::class, name = "killCharacter"),
    JsonSubTypes.Type(MoveCharacterPayload::class, name = "moveCharacter"),
    JsonSubTypes.Type(PledgeResourcePayload::class, name = "pledgeResource"),
    JsonSubTypes.Type(ReleasePledgePayload::class, name = "releasePledge"),
    JsonSubTypes.Type(SpendResourcePayload::class, name = "spendResource"),
    JsonSubTypes.Type(TakeActionPayload::class, name = "takeAction"),
    JsonSubTypes.Type(TakeOffTheMapPayload::class, name = "takeOffTheMap"),
    JsonSubTypes.Type(GiveVisionPayload::class, name = "giveVision"),
    JsonSubTypes.Type(TakeVisionPayload::class, name = "takeVision"),
    JsonSubTypes.Type(OfferDialoguePayload::class, name = "offerDialogue"),
    JsonSubTypes.Type(CompleteDialogueStepPayload::class, name = "completeDialogueStep"),
    JsonSubTypes.Type(RollPayload::class, name = "roll"),
    JsonSubTypes.Type(NextRarityPayload::class, name = "nextRarity"),
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
 * month is belongs to the calendar and not to whoever is asking. See decision record 0053.
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

/**
 * Bring a newcomer in as one of this player's house's key figures: rolled by the server and named by nobody.
 * Adam's lever for now, and the only way a character comes into the world. See decision record 0055.
 */
class AddKeyFigurePayload : CommandPayload {
    override fun equals(other: Any?): Boolean = other is AddKeyFigurePayload

    override fun hashCode(): Int = javaClass.hashCode()

    override fun toString(): String = "AddKeyFigurePayload"
}

/**
 * The levers on one of this player's key figures. Each names the character, and the server asks the player's
 * own house first: anybody who is not one of its key figures is refused `noSuchKeyFigure` before their record
 * is touched. `stat` is `piety`, `reason`, `kindness` or `physical`, and `by` and `years` may be negative.
 */
data class ChangeStatPayload(val characterId: String, val stat: String, val by: Int) : CommandPayload

data class AgeCharacterPayload(val characterId: String, val years: Int) : CommandPayload

/** Another portrait by its key, or none when `portrait` is absent. */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class ChangePortraitPayload(val characterId: String, val portrait: String? = null) : CommandPayload

data class KillCharacterPayload(val characterId: String, val cause: String) : CommandPayload

/**
 * Put one of the player's key figures somewhere on the map. The place and nothing else: how much they matter
 * there is the world's to say, not the client's. See decision record 0026.
 */
data class MoveCharacterPayload(val characterId: String, val place: Point) : CommandPayload

data class TakeOffTheMapPayload(val characterId: String) : CommandPayload

/**
 * Give the player's house vision of a place, outright, until it is taken away: a circle of the world's size
 * about it. The place and nothing else; how far a house sees is the world's to say. Adam's lever. See 0061.
 */
data class GiveVisionPayload(val place: Point) : CommandPayload

/** Take away a vision the house was given, by the id `yourSight` names it under. */
data class TakeVisionPayload(val visionId: String) : CommandPayload

/**
 * Offer the player's house one of the sample dialogues, by its name, spoken by the house's first key figure.
 * The name and none of the words: a client that could write a dialogue could write itself a reward. Adam's
 * lever. See decision record 0071.
 */
data class OfferDialoguePayload(val sample: String) : CommandPayload

/**
 * Take a step through one of the house's dialogues: the line that is the step, by its id within the dialogue -
 * an option of a dialogue choice, or the line the stretch read ends on. Which lines are steps, and whether this
 * one is the next, is the house's to say, so the client names a line and nothing else. See decision record 0071.
 */
data class CompleteDialogueStepPayload(val dialogueId: String, val lineId: String) : CommandPayload

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
)
sealed interface ServerFrame

/** The answer to hello, carrying where the world's clock stands. The player's own house follows in `yourHouse`. */
data class Welcome(val serverTime: Long, val playerId: String, val world: WorldNow) : ServerFrame

/**
 * What a cell holds, sent on subscribing to it, before any deltas. `omitted` is how many more houses the
 * cell had than a snapshot carries, so a screen never claims to show all of what it shows most of, and
 * `omittedCharacters` the same for the characters standing in it. A cell with nobody standing in it
 * carries no `characters` at all.
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

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes(
    JsonSubTypes.Type(HouseAppeared::class, name = "houseAppeared"),
    JsonSubTypes.Type(HouseChanged::class, name = "houseChanged"),
    JsonSubTypes.Type(CharacterArrived::class, name = "characterArrived"),
    JsonSubTypes.Type(CharacterChanged::class, name = "characterChanged"),
    JsonSubTypes.Type(CharacterGone::class, name = "characterGone"),
)
sealed interface Delta

data class HouseAppeared(val house: HouseView) : Delta

data class HouseChanged(val house: HouseView) : Delta

/**
 * A character came to stand in a cell this connection holds, from nowhere or from a cell it did not hold.
 * Houses never move, so a client never had to drop anything; a character does, which is why there are three
 * of these where a house has two. The client keeps them in the held cells their `cell` falls in, and no
 * other.
 */
data class CharacterArrived(val character: CharacterOnMapView) : Delta

/** A character already drawn here moved within what this connection holds, or changed how they are drawn. */
data class CharacterChanged(val character: CharacterOnMapView) : Delta

/** A character left every cell this connection holds: moved away, taken off the map, or dead. */
data class CharacterGone(val id: String, val version: Long) : Delta
