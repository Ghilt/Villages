package villages.projections

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import villages.application.DialogueEnding
import villages.application.DialoguesChange
import villages.application.EventFeed
import villages.application.Start
import villages.application.StoredEvent
import villages.application.started
import villages.domain.CharacterId
import villages.domain.Dialogue
import villages.domain.DialogueId
import villages.domain.HouseEvent
import villages.domain.HouseId
import villages.domain.Line
import villages.domain.LineId
import villages.domain.PlayerCompletedDialogue
import villages.domain.PlayerCompletedDialogueStep
import villages.domain.PlayerId
import villages.domain.PlayerLostDialogue
import villages.domain.PlayerOfferedDialogue
import villages.domain.Requirement
import villages.domain.Speaker
import villages.domain.SpeakerId
import villages.domain.Then
import villages.domain.WorldTime
import java.time.Instant
import java.util.UUID

/** A feed that delivers what it is handed, when it is handed it, and can hand over what came before. */
private class DialoguesFed : EventFeed {
    private val stored = mutableListOf<StoredEvent>()
    private val subscribers = mutableListOf<(StoredEvent) -> Unit>()

    override fun subscribe(from: Start, subscriber: (StoredEvent) -> Unit): AutoCloseable {
        if (from == Start.FROM_THE_BEGINNING) {
            stored.forEach(subscriber)
        }
        subscribers += subscriber
        return AutoCloseable { subscribers -= subscriber }
    }

    fun deliver(event: HouseEvent, story: String = "a-story") {
        val record = StoredEvent(
            id = UUID.randomUUID().toString(),
            type = "villages.player.x.v1",
            stream = event.houseId.stream,
            streamVersion = stored.size + 1L,
            time = event.recordedAt,
            data = "{}",
            correlationId = story,
            causationId = UUID.randomUUID().toString(),
            event = event,
        )
        stored += record
        subscribers.toList().forEach { it(record) }
    }
}

class DialoguesProjectionSpec : StringSpec({
    val noon = Instant.parse("2026-09-04T12:00:00Z")
    val day = WorldTime(653_705)
    val ada = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    val house = HouseId.of(ada)
    val messenger = Speaker(SpeakerId("messenger"), party = 1, name = "A messenger", portrait = null, character = null)

    fun dialogue(n: Int) = Dialogue(
        id = DialogueId(UUID.fromString("dd000000-0000-4000-8000-00000000a00$n")),
        title = "Letter $n",
        scene = null,
        speakers = listOf(messenger),
        lines = listOf(
            Line(LineId("news"), messenger.id, "The harbour is ours.", then = Then.Say(LineId("end"))),
            Line(LineId("end"), messenger.id, "That is all.", recorded = true, then = Then.End),
        ),
    )

    fun offered(n: Int) = PlayerOfferedDialogue(house, ada, dialogue(n), day, noon)
    fun stepped(n: Int, line: String) = PlayerCompletedDialogueStep(house, ada, dialogue(n).id, LineId(line), day, noon)
    fun finished(n: Int) = PlayerCompletedDialogue(house, ada, dialogue(n).id, day, noon)

    "a dialogue offered is held for its house, open, at revision one, in the story it was offered in" {
        val feed = DialoguesFed()
        val dialogues = DialoguesProjection(feed).started()

        feed.deliver(offered(1), story = "the-letter")

        val row = dialogues.of(house).single()
        row.dialogue shouldBe dialogue(1)
        row.player shouldBe ada
        row.taken shouldBe emptyList()
        row.ending shouldBe DialogueEnding.Open
        row.correlationId shouldBe "the-letter"
        row.revision shouldBe 1
    }

    "each step and the end raise the revision, and the steps are kept in the order they were taken" {
        val feed = DialoguesFed()
        val dialogues = DialoguesProjection(feed).started()

        feed.deliver(offered(1))
        feed.deliver(stepped(1, "end"))
        dialogues.of(house).single().let {
            it.taken shouldBe listOf(LineId("end"))
            it.revision shouldBe 2
            it.ending shouldBe DialogueEnding.Open
        }

        feed.deliver(finished(1))
        dialogues.of(house).single().let {
            it.ending shouldBe DialogueEnding.Completed
            it.revision shouldBe 3
        }
    }

    "a house keeps every dialogue in the order it was offered them, open and finished alike" {
        val feed = DialoguesFed()
        val dialogues = DialoguesProjection(feed).started()

        feed.deliver(offered(1))
        feed.deliver(offered(2))
        feed.deliver(stepped(1, "end"))
        feed.deliver(finished(1))

        dialogues.of(house).map { it.dialogue.id to it.ending } shouldBe listOf(
            dialogue(1).id to DialogueEnding.Completed,
            dialogue(2).id to DialogueEnding.Open,
        )
        // A change to one leaves the other as it was, revision and all.
        dialogues.of(house)[1].revision shouldBe 1
        dialogues.of(HouseId(UUID.randomUUID())) shouldBe emptyList()
    }

    "whoever watches is told the house's dialogues whenever one of them changes" {
        val feed = DialoguesFed()
        val dialogues = DialoguesProjection(feed).started()
        val told = mutableListOf<DialoguesChange>()
        dialogues.watch { told += it }

        feed.deliver(offered(1))
        feed.deliver(stepped(1, "end"))
        feed.deliver(finished(1))

        told shouldHaveSize 2
        told.last().player shouldBe ada
        told.last().dialogues.single().taken shouldBe listOf(LineId("end"))
    }

    // Between the two events of the decision the dialogue is open with nothing left in it, which cannot be.
    "the step on the line that ends a dialogue is told with the end, and never as a dialogue open with nothing in it" {
        val feed = DialoguesFed()
        val dialogues = DialoguesProjection(feed).started()
        val told = mutableListOf<DialoguesChange>()
        dialogues.watch { told += it }
        feed.deliver(offered(1))

        feed.deliver(stepped(1, "end"))
        told shouldHaveSize 1
        dialogues.of(house).single().taken shouldBe listOf(LineId("end"))

        feed.deliver(finished(1))
        told shouldHaveSize 2
        told.last().dialogues.single().ending shouldBe DialogueEnding.Completed
    }

    "a read model built from the beginning holds what one that watched it all holds" {
        val feed = DialoguesFed()
        val watching = DialoguesProjection(feed).started()
        feed.deliver(offered(1))
        feed.deliver(stepped(1, "end"))
        feed.deliver(finished(1))

        DialoguesProjection(feed).started().of(house) shouldBe watching.of(house)
    }

    "a dialogue lost says which of its requirements failed, and moves its revision on like any change" {
        val feed = DialoguesFed()
        val dialogues = DialoguesProjection(feed).started()
        val agnes = CharacterId(UUID.fromString("cb732500-39bd-3b39-a838-bb89f719578f"))

        feed.deliver(offered(1))
        feed.deliver(PlayerLostDialogue(house, ada, dialogue(1).id, Requirement.Alive(agnes), day, noon))

        dialogues.of(house).single().let {
            it.ending shouldBe DialogueEnding.Lost(Requirement.Alive(agnes))
            it.revision shouldBe 2
        }
    }

    "a wipe forgets every dialogue" {
        val feed = DialoguesFed()
        val dialogues = DialoguesProjection(feed).started()
        feed.deliver(offered(1))

        dialogues.reset()

        dialogues.of(house) shouldBe emptyList()
    }
})
