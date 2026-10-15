package villages.domain

/**
 * What a house set out to do: the quests it was offered and has not finished, each with what it recorded of it,
 * and every one it was ever offered. The part of a founded house that decides its quest commands and folds its
 * quest events. What a node does to the rest of the house - a dialogue offered, a cost paid, a reward given - it
 * asks of the house, through [Follow], and never does itself. See decision records 0075 and 0096.
 */
data class Quests(
    /** The quests offered and not finished, in the order they were offered. A finished one leaves the list. */
    val open: List<OpenQuest> = emptyList(),
    /** Every quest ever offered, open or over, so that the same offer twice is refused. */
    val offered: Set<QuestId> = emptySet(),
) {
    internal fun decide(command: QuestCommand, player: PlayerId, follow: Follow): List<HouseEvent> = when (command) {
        // Several can be open at once, and the quest has checked itself already, so what is left to the house is
        // that it exists and has not been offered this one before. Its first node is reached at once.
        is OfferQuest -> {
            if (command.quest.id in offered) {
                throw HouseError.QuestAlreadyOffered
            }
            listOf(PlayerOfferedQuest(command.houseId, player, command.quest, command.worldTime, command.recordedAt)) +
                follow.follow(arriving(command.quest.start()), player, command.worldTime, command.recordedAt)
        }
    }

    internal fun evolve(event: QuestEvent): Quests = when (event) {
        is PlayerOfferedQuest -> copy(open = open + OpenQuest(event.quest), offered = offered + event.quest.id)
    }
}

/**
 * What reaching a node does to the house, as effects: a dialogue node offers its dialogue, and an objective or a
 * reward node does nothing until it is met or collected.
 */
internal fun arriving(node: QuestNode): List<Effect> = when (node) {
    is DialogueNode -> listOf(Effect.Converse(node.dialogue))
    is ObjectiveNode, is RewardNode -> emptyList()
}

/**
 * A quest a house has open, and what it recorded of it so far, in order: all it needs to know where the quest
 * stands.
 */
data class OpenQuest(
    val quest: Quest,
    val progress: List<QuestProgress> = emptyList(),
) {
    /** Where it has got to. */
    fun walk(): QuestWalk = quest.walk(progress)
}
