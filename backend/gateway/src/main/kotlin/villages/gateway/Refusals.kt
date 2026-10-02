package villages.gateway

import villages.domain.CharacterError
import villages.domain.DomainError
import villages.domain.HouseError

/** A domain refusal as the short code the protocol carries, which the interface turns into words. */
internal fun DomainError.reasonCode(): String = when (this) {
    HouseError.AlreadyFounded -> "alreadyFounded"
    is HouseError.InvalidName -> "invalidName"
    is DomainError.InvalidLocation -> "invalidLocation"
    is HouseError.InvalidBanner -> "invalidBanner"
    is HouseError.InvalidChoice -> "invalidChoice"
    is HouseError.InvalidDialogue -> "invalidDialogue"
    HouseError.DialogueAlreadyOffered -> "dialogueAlreadyOffered"
    HouseError.NoSuchDialogue -> "noSuchDialogue"
    HouseError.DialogueOver -> "dialogueOver"
    HouseError.NotTheNextStep -> "notTheNextStep"
    HouseError.ChoicePending -> "choicePending"
    HouseError.NoChoicePending -> "noChoicePending"
    HouseError.NoSuchChoice -> "noSuchChoice"
    HouseError.NoSuchOption -> "noSuchOption"
    HouseError.NoSuchHouse -> "noSuchHouse"
    HouseError.NoSuchPledge -> "noSuchPledge"
    HouseError.TooManyKeyFigures -> "tooManyKeyFigures"
    HouseError.AlreadyAKeyFigure -> "alreadyAKeyFigure"
    HouseError.NoSuchKeyFigure -> "noSuchKeyFigure"
    HouseError.NoSuchVision -> "noSuchVision"
    is HouseError.InvalidVision -> "invalidVision"
    is HouseError.InvalidAmount -> "invalidAmount"
    is HouseError.InvalidPledge -> "invalidPledge"
    is HouseError.NotEnoughFree -> "notEnoughFree"
    CharacterError.AlreadyAppeared -> "alreadyAppeared"
    CharacterError.NoSuchCharacter -> "noSuchCharacter"
    CharacterError.AlreadyDead -> "alreadyDead"
    // The same words as a house's refusal of the same rule, because the interface says them the same way.
    is CharacterError.InvalidName -> "invalidName"
    is CharacterError.InvalidStat -> "invalidStat"
    is CharacterError.InvalidAge -> "invalidAge"
    is CharacterError.InvalidPortrait -> "invalidPortrait"
    is CharacterError.InvalidCause -> "invalidCause"
    CharacterError.NotOnTheMap -> "notOnTheMap"
}
