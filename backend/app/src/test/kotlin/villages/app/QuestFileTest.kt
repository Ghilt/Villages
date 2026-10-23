package villages.app

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import villages.application.CatalogueRefused
import villages.application.QuestTemplate.ChallengeAt
import villages.application.QuestTemplate.DialogueAt
import villages.application.QuestTemplate.ObjectivesAt
import villages.application.QuestTemplate.RewardAt
import villages.domain.Edge
import villages.domain.Effect
import villages.domain.LineId
import villages.domain.NodeId
import villages.domain.Objective
import villages.domain.ObjectiveId
import villages.domain.Opponent
import villages.domain.Resource
import villages.domain.Stat
import villages.domain.StructureType
import villages.domain.Verdict
import villages.domain.Where
import villages.domain.challenge.Aspect
import villages.domain.challenge.ChallengeSlice
import villages.domain.challenge.StandIn
import java.io.File

/** A quest file as the server reads it, held to the fixture the world package's reader is held to. */
class QuestFileTest {
    private val fixture = File("../../contracts/fixtures/quest.json").readText()
    private val shelf = FolderCatalogues(File("../../world/catalogues").toPath())

    @Test
    fun `the fixture reads as it says, every kind of node and objective once`() {
        val quest = QuestFile.parse(fixture, "fixture")

        assertEquals("A road to the sea", quest.title)
        assertEquals(true, quest.shownFromTheStart)
        val (talk, give, hold, dare, prize) = quest.nodes
        assertEquals("a-word", (talk as DialogueAt).dialogue)
        assertEquals(listOf(Edge(NodeId("give"), setOf(LineId("yes"))), Edge(NodeId("hold"), setOf(LineId("no")))), talk.edges)
        assertEquals(
            listOf(Objective.Deliver(ObjectiveId("coin"), Resource.WEALTH, 5), Objective.Pledge(ObjectiveId("oath"), Resource.PIETY, 3, 2)),
            (give as ObjectivesAt).objectives,
        )
        assertEquals(
            listOf(Objective.Hold(ObjectiveId("mill"), StructureType("mill"), Where.Anywhere), Objective.Hold(ObjectiveId("fort"), StructureType("castle"), Where.Island)),
            (hold as ObjectivesAt).objectives,
        )
        assertEquals(true, hold.hidden)
        val (kind, against, slices) = (dare as ChallengeAt).challenge
        assertEquals("debate", kind)
        assertEquals(Opponent("A rival", "#a8452a"), against)
        assertEquals(
            listOf(
                ChallengeSlice(
                    Aspect.REASON, 50.0, 46.0, 3, listOf("reason.counsel", "reason.doubt"),
                    mapOf("reason.counsel" to StandIn.KeyFigure("A scholar", mapOf(Stat.PIETY to 8, Stat.REASON to 16, Stat.KINDNESS to 9, Stat.PHYSICAL to 7))),
                ),
                ChallengeSlice(
                    Aspect.HOLY, 50.0, 50.0, 3, listOf("holy.ordination", "holy.sanctuary"),
                    mapOf("holy.sanctuary" to StandIn.Building("A chapel", 1)),
                ),
            ),
            slices,
        )
        assertEquals(listOf(Edge(NodeId("prize"), verdict = Verdict.WON), Edge(NodeId("give"), verdict = Verdict.LOST)), dare.edges)
        assertEquals(listOf(Effect.Grant(Resource.REASON, 7)), (prize as RewardAt).gives)
        assertEquals(true, prize.shownAhead)
    }

    @Test
    fun `the real shelf reads, every quest holding together with the dialogues and structures beside it, in the one form`() {
        val files = shelf.read()
        ShelfReader.read(files)
        files.filterKeys { it.startsWith("quests/") }.values.forEach { assertEquals(it, CatalogueText.format(it)) }
    }

    @Test
    fun `a quest putting a challenge of a kind there is not, or with slices that cannot be fought, is refused`() {
        val files = shelf.read()
        val debate = files.getValue("quests/the-debate")

        val noKind = assertThrows<CatalogueRefused> {
            ShelfReader.read(files + ("quests/the-debate" to debate.replace("\"kind\": \"debate\"", "\"kind\": \"duel\"")))
        }
        assertEquals("world/catalogues/quests/the-debate.json: node square puts a challenge of kind duel, which the challenges do not have", noKind.message)
        val noEffect = assertThrows<CatalogueRefused> {
            ShelfReader.read(files + ("quests/the-debate" to debate.replace("\"reason.doubt\"", "\"reason.sophistry\"")))
        }
        assertEquals(
            "world/catalogues/quests/the-debate.json: node square: the opponent's slice 1 carries reason.sophistry, which is not an effect",
            noEffect.message,
        )
    }

    @Test
    fun `a quest naming a dialogue or a type of structure there is not is refused, naming the file and why`() {
        val files = shelf.read()
        val abbot = files.getValue("quests/abbot")

        val noDialogue = assertThrows<CatalogueRefused> {
            ShelfReader.read(files + ("quests/abbot" to abbot.replace("\"the-consecration\"", "\"a-hymn\"")))
        }
        assertEquals("world/catalogues/quests/abbot.json: node consecration offers a-hymn, which is not in dialogues/", noDialogue.message)
        val noType = assertThrows<CatalogueRefused> {
            ShelfReader.read(files + ("quests/abbot" to abbot.replace("\"holds\": \"castle\"", "\"holds\": \"lighthouse\"")))
        }
        assertEquals("world/catalogues/quests/abbot.json: node light asks a lighthouse be held, a type the structures do not have", noType.message)
    }
}
