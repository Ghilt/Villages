package villages.protocol

import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo

// The commands a client can send inside a `command` frame, each a payload naming its type. See Frames.kt for
// what a frame is; the frame that carries one is `Command`.

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
