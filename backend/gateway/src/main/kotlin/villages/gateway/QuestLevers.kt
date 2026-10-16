package villages.gateway

import villages.application.QuestService
import villages.protocol.OfferQuestPayload

/**
 * Adam's lever for quests, standing in for the world, which offers none yet: one of the server's samples offered to
 * the sender's house, by its name. A name that is not a sample is refused as malformed, and a house that does not
 * exist as `noSuchHouse`. Registered by the instruments and closed with them. Meeting, collecting and seeing how one
 * ended are the player's, in the pane, and never levers. See decision record 0096.
 */
internal fun questLevers(commands: Commands, open: Boolean, quests: QuestService) {
    commands.lever<OfferQuestPayload>(open) { asking, payload ->
        quests.offer(player = asking.who, name = payload.sample, provenance = asking.startingAStory)
    }
}
