package villages.domain

import villages.domain.challenge.ChallengeSetup
import villages.domain.challenge.ChallengeSlice
import java.util.UUID

/**
 * A story with a goal, offered to a house whole: nodes joined by edges, read from the top down, and walked a
 * node at a time - a dialogue to finish, a checklist of objectives to tick, a reward to collect, a challenge to fight.
 *
 * Recorded whole on the event that offers it, every dialogue inside it included, so the roads not taken are
 * history and every move can be checked against the house's own history alone. It checks itself when it is
 * made: a quest that could loop, that leads to a node it does not hold, or that forks where nothing could
 * decide the fork, is refused before anything is written. What is done and lost is recorded; how any of it is
 * drawn is worked out by [walk]. See decision record 0096.
 */
data class Quest(
    val id: QuestId,
    /** What the list of quests shows, and the purpose of any pledge made for it. */
    val title: String,
    /** The picture behind its map, by its key, or none. */
    val scene: String?,
    /** Every node of it. The first is where it starts. */
    val nodes: List<QuestNode>,
    /** Whether every node is drawn from the first moment, as if each were shown ahead, so the road can be planned. */
    val shownFromTheStart: Boolean = false,
) {
    init {
        if (title.isBlank()) refuse("a quest has a title")
        if (nodes.isEmpty()) refuse("a quest has a node to start at")
        refuseUnlessWords(nodes.map { it.id.value }, "node")
        nodes.forEach(::refuseUnlessSound)
        refuseUnlessEveryRoadEnds()
    }

    /** The node it starts at. A function rather than a property, so the store writes the nodes and only them. */
    fun start(): QuestNode = nodes.first()

    /** The node with this id, or null when the quest has none. */
    fun node(id: NodeId): QuestNode? = nodes.firstOrNull { it.id == id }

    private fun refuseUnlessSound(node: QuestNode) {
        val which = "node ${node.id.value}"
        if (node.title.isBlank()) refuse("$which has no title")
        node.edges.firstOrNull { node(it.to) == null }?.let {
            refuse("$which leads to node ${it.to.value}, which the quest does not have")
        }
        if (node.edges.map { it.to }.distinct().size != node.edges.size) refuse("$which has two edges to one node")
        when (node) {
            is DialogueNode -> refuseUnlessTheEndingsDecide(node)
            is ObjectiveNode -> {
                refuseUnlessOneRoad(node, "a checklist")
                if (node.objectives.size !in 1..ObjectiveNode.MOST) {
                    refuse("$which holds ${node.objectives.size} objectives, not 1 to ${ObjectiveNode.MOST}")
                }
                refuseUnlessWords(node.objectives.map { it.id.value }, "objective of $which")
            }
            is RewardNode -> {
                refuseUnlessOneRoad(node, "a reward")
                if (node.gives.isEmpty()) refuse("$which gives nothing")
            }
            is ChallengeNode -> refuseUnlessTheVerdictDecides(node)
        }
    }

    /** Only a dialogue's ending or a challenge's verdict can decide a fork, so any other node goes one way on, or none. */
    private fun refuseUnlessOneRoad(node: QuestNode, what: String) {
        if (node.edges.size > 1) refuse("node ${node.id.value} forks, and $what cannot decide which road is taken")
        if (node.edges.any { it.endings.isNotEmpty() }) refuse("node ${node.id.value} names endings, and has no dialogue")
        if (node.edges.any { it.verdict != null }) refuse("node ${node.id.value} names a verdict, and puts no challenge")
    }

    /**
     * A challenge node's terms hold together - a kind, an opponent with a name and a colour, one to three slices - and
     * its edges name no endings. Where it forks it forks on won and lost, an edge each, so however the challenge goes
     * the quest knows which way; its only edge naming no verdict is taken either way.
     */
    private fun refuseUnlessTheVerdictDecides(node: ChallengeNode) {
        val which = "node ${node.id.value}"
        val (kind, against, slices) = node.challenge
        if (kind.isBlank()) refuse("$which puts a challenge of no kind")
        if (against.name.isBlank()) refuse("$which puts a challenge from nobody")
        if (!COLOUR.matches(against.colour)) refuse("$which's opponent is shown in ${against.colour}, not a colour like #a8452a")
        if (slices.size !in 1..ChallengeSetup.MOST_SLICES) {
            refuse("$which's opponent brings ${slices.size} slices, not 1 to ${ChallengeSetup.MOST_SLICES}")
        }
        if (node.edges.any { it.endings.isNotEmpty() }) refuse("$which names endings, and has no dialogue")
        val verdicts = node.edges.mapNotNull { it.verdict }
        if (verdicts.isEmpty() && node.edges.size < 2) return
        if (node.edges.size != 2 || verdicts.toSet() != Verdict.entries.toSet()) {
            refuse("$which forks, and a challenge leads one way when it is won and the other when it is lost")
        }
    }

    /**
     * A dialogue node's dialogue is offered once, under an id worked out from the quest and the node; and where
     * it forks, every ending of the dialogue leads along exactly one edge, so however it ends the quest knows
     * which way to go. One edge may name no endings, and then every ending leads along it.
     */
    private fun refuseUnlessTheEndingsDecide(node: DialogueNode) {
        val which = "node ${node.id.value}"
        if (node.dialogue.id != DialogueId.ofNode(id, node.id)) {
            refuse("$which's dialogue is not under the id worked out from the quest and the node")
        }
        if (node.edges.any { it.verdict != null }) refuse("$which names a verdict, and puts no challenge")
        val endings = node.dialogue.lines.filter { it.then == Then.End }.map { it.id }.toSet()
        node.edges.flatMap { it.endings }.firstOrNull { it !in endings }?.let {
            refuse("$which leads on after ${it.value}, which does not end its dialogue")
        }
        if (node.edges.size < 2 && node.edges.all { it.endings.isEmpty() || it.endings == endings }) return
        node.edges.firstOrNull { it.endings.isEmpty() }?.let {
            refuse("$which forks, and its edge to ${it.to.value} names no ending of the dialogue")
        }
        val named = node.edges.flatMap { it.endings }
        if (named.distinct().size != named.size) refuse("$which leads two ways after one ending of its dialogue")
        (endings - named.toSet()).firstOrNull()?.let {
            refuse("$which leads nowhere after ${it.value}, which ends its dialogue")
        }
    }

    /**
     * No node can be reached from itself, so every road ends and a reward is paid once on any of them; and every
     * node is reached from the start, so nothing written is never walked.
     */
    private fun refuseUnlessEveryRoadEnds() {
        val byId = nodes.associateBy { it.id }
        val reached = mutableSetOf<NodeId>()
        val onTheRoad = mutableSetOf<NodeId>()

        fun walk(id: NodeId) {
            if (id in reached) return
            if (!onTheRoad.add(id)) refuse("node ${id.value} can be reached from itself, so a road would not end")
            byId.getValue(id).edges.forEach { walk(it.to) }
            onTheRoad -= id
            reached += id
        }

        walk(start().id)
        nodes.firstOrNull { it.id !in reached }?.let { refuse("nothing leads to node ${it.id.value}") }
    }

    private fun refuseUnlessWords(ids: List<String>, what: String) {
        ids.firstOrNull { it.isEmpty() || it.length > LONGEST_ID || it.any(Char::isWhitespace) }?.let {
            refuse("a $what's id is a word of at most $LONGEST_ID characters, and \"$it\" is not")
        }
        if (ids.distinct().size != ids.size) refuse("two of a quest's ${what}s share an id")
    }

    private fun refuse(reason: String): Nothing = throw HouseError.InvalidQuest(reason)

    companion object {
        /** An id is a word to write a quest with, as a dialogue's are. */
        const val LONGEST_ID = Dialogue.LONGEST_ID

        /** A colour a side is shown in, as the page writes one. */
        private val COLOUR = Regex("#[0-9a-fA-F]{6}")
    }
}

/**
 * One place on a quest's road. Each is done in its own way - a dialogue finished, a checklist ticked, a reward
 * collected, a challenge fought - and then the quest moves on along one of its edges, or ends when it has none.
 */
sealed interface QuestNode {
    val id: NodeId

    /** A line: what the node is called on the map. */
    val title: String

    /** Drawn as a question mark until the quest reaches it, or loses it. */
    val hidden: Boolean

    /** Drawn from the moment the quest is offered, however far down it stands, with its edges in and out. */
    val shownAhead: Boolean

    /** The nodes it leads to. More than one is a fork, which only a dialogue node or a challenge node can decide. */
    val edges: List<Edge>
}

/** Offers its dialogue when the quest reaches it, and is done when the dialogue ends; the ending picks the edge. */
data class DialogueNode(
    override val id: NodeId,
    override val title: String,
    val dialogue: Dialogue,
    override val edges: List<Edge> = emptyList(),
    override val hidden: Boolean = false,
    override val shownAhead: Boolean = false,
) : QuestNode

/** A checklist: done when every one of its objectives is ticked, in any order. */
data class ObjectiveNode(
    override val id: NodeId,
    override val title: String,
    val objectives: List<Objective>,
    override val edges: List<Edge> = emptyList(),
    override val hidden: Boolean = false,
    override val shownAhead: Boolean = false,
) : QuestNode {
    companion object {
        /** A checklist is short, or it is a list of chores. */
        const val MOST = 6
    }
}

/** What the house gets, waiting to be collected: done when the player collects it. */
data class RewardNode(
    override val id: NodeId,
    override val title: String,
    /** What collecting it gives the house, and only grants: a reward that could be refused is not one. */
    val gives: List<Effect.Grant>,
    override val edges: List<Edge> = emptyList(),
    override val hidden: Boolean = false,
    override val shownAhead: Boolean = false,
) : QuestNode

/**
 * Puts a challenge to the house when the quest reaches it, on its own terms: done when the player accepts it with
 * slices of the house's own, which fights it out in the same decision; whether the house won picks the edge, a draw
 * counting as lost. Nothing is stored between: the challenge is no more than these terms until it is fought. See
 * decision records 0096 and 0107, amended.
 */
data class ChallengeNode(
    override val id: NodeId,
    override val title: String,
    val challenge: QuestChallenge,
    override val edges: List<Edge> = emptyList(),
    override val hidden: Boolean = false,
    override val shownAhead: Boolean = false,
) : QuestNode

/**
 * The terms of a challenge a quest puts to the house: its kind, by its name in the challenge catalogue, `debate`; who
 * stands against the house; and the slices they bring, which the player does not see before it starts.
 */
data class QuestChallenge(val kind: String, val against: Opponent, val slices: List<ChallengeSlice>)

/** Who stands against the house in a quest's challenge: a name, and the colour their side is shown in, `#a8452a`. */
data class Opponent(val name: String, val colour: String)

/** Which way a challenge went for the house, as an edge out of a challenge node names it. A draw is lost. */
enum class Verdict { WON, LOST }

/**
 * The way from one node to the next. Out of a dialogue node it names the endings of the dialogue - the lines
 * that end it - which lead along it; none, on a node's only edge, is every ending. Out of a challenge node it names
 * the [verdict] that leads along it; none, on its only edge, is either.
 */
data class Edge(val to: NodeId, val endings: Set<LineId> = emptySet(), val verdict: Verdict? = null)

/**
 * One row of a checklist: something the house must do before the node moves on. Met by the player, who presses
 * for it and pays, or by the world, which a listener notices. A new kind is one case in one of the two families.
 */
sealed interface Objective {
    val id: ObjectiveId

    /** Met by the player's own press, which pays for it in the house's own rules and at once. */
    sealed interface MetByThePlayer : Objective

    /** Met by the world, a moment after it happens, carried to the house by the listener for objectives. */
    sealed interface MetByTheWorld : Objective

    /** Hand over an amount of a resource: the press spends it, refused while not that much is free. */
    data class Deliver(override val id: ObjectiveId, val resource: Resource, val amount: Long) : MetByThePlayer {
        init {
            if (amount <= 0) throw HouseError.InvalidAmount("a delivery is of more than nothing, and $amount is not")
        }
    }

    /** Tie an amount of a resource to the quest for some months: the press pledges it, and it comes back whole. */
    data class Pledge(
        override val id: ObjectiveId,
        val resource: Resource,
        val amount: Long,
        val months: Int,
    ) : MetByThePlayer {
        init {
            if (amount <= 0) throw HouseError.InvalidAmount("a pledge is of more than nothing, and $amount is not")
            if (months < 1) throw HouseError.InvalidQuest("a pledge is for a month at least, not $months")
        }
    }

    /** Come to hold a structure of a type, somewhere: ticked the moment the house holds one, and then for good. */
    data class Hold(
        override val id: ObjectiveId,
        val structureType: StructureType,
        val where: Where = Where.Anywhere,
    ) : MetByTheWorld
}

/** Where a structure an objective asks for must stand. A new kind of place is one more case. */
sealed interface Where {
    data object Anywhere : Where

    /** On a land mass smaller than the smallest continent. */
    data object Island : Where
}

/** The identity of one quest, so a move can only be made in a quest the house was offered. */
@JvmInline
value class QuestId(val value: UUID) {
    companion object {
        /** What a quest is named after, so the derivation cannot collide with anything else. */
        private const val NAMED_AFTER = "villages:quest:"

        /**
         * The quest a command offers a house. Worked out rather than minted, as a dialogue's identity is, so the
         * same command sent twice offers one quest and the house refuses the second. The house is in the name as
         * well as the command, because a command's id is public.
         */
        fun offered(house: HouseId, commandId: UUID): QuestId =
            QuestId(UUID.nameUUIDFromBytes("$NAMED_AFTER${house.value}:$commandId".toByteArray(Charsets.UTF_8)))
    }
}

/** One node within one quest. A word, so a quest written by hand reads. */
@JvmInline
value class NodeId(val value: String)

/** One objective within one node. A word, as a node's is. */
@JvmInline
value class ObjectiveId(val value: String)

/** What a quest's dialogue is named after, so the derivation cannot collide with anything else. */
private const val QUEST_DIALOGUE = "villages:quest-dialogue:"

/**
 * The dialogue a quest's dialogue node offers. Worked out from the quest and the node, so it is offered once
 * however often the node is heard of, and a quest offered twice is refused before its dialogue could be.
 */
fun DialogueId.Companion.ofNode(quest: QuestId, node: NodeId): DialogueId =
    DialogueId(UUID.nameUUIDFromBytes("$QUEST_DIALOGUE${quest.value}:${node.value}".toByteArray(Charsets.UTF_8)))
