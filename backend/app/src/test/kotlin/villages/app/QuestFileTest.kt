package villages.app

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import villages.application.CatalogueRefused
import villages.application.QuestTemplate.DialogueAt
import villages.application.QuestTemplate.ObjectivesAt
import villages.application.QuestTemplate.RewardAt
import villages.domain.Edge
import villages.domain.Effect
import villages.domain.LineId
import villages.domain.NodeId
import villages.domain.Objective
import villages.domain.ObjectiveId
import villages.domain.Resource
import villages.domain.StructureType
import villages.domain.Where
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
        val (talk, give, hold, prize) = quest.nodes
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
