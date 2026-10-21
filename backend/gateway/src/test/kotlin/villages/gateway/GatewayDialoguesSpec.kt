package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.string.shouldStartWith
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import villages.application.Provenance
import villages.domain.CompleteDialogueStep
import villages.domain.FailRequirement
import villages.domain.Requirement
import villages.domain.CharacterId
import villages.domain.Effect
import villages.domain.GrantResource
import villages.domain.LineId
import villages.domain.PlayerOfferedDialogue
import villages.domain.Resource
import villages.protocol.CommandAccepted
import villages.protocol.CommandRejected
import villages.protocol.RequirementView
import villages.protocol.RevealImpactView
import villages.protocol.EndingView
import villages.protocol.GrantView
import villages.protocol.ImpactView
import villages.protocol.SpendView
import villages.protocol.EventFrame
import villages.protocol.ProtocolJson
import villages.protocol.ServerFrame
import villages.protocol.ShowsView
import villages.protocol.YourHouse
import villages.protocol.YourDialogues
import villages.protocol.YourKeyFigures
import java.util.UUID

/** The gateway: offering a dialogue, and its player reading and stepping through it. The rig is GatewayRig.kt. */
class GatewayDialoguesSpec : StringSpec({

    "the debug panel's letter is offered, spoken by the house's first key figure, and refused while it has none" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(offering("letter", commandNumber(1)))
        sent.last() shouldBe CommandRejected(commandNumber(1), "noSuchKeyFigure")

        mine.receive(addingAKeyFigure(commandNumber(2)))
        val figure = sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id
        mine.receive(offering("letter", commandNumber(3)))

        sent.last() shouldBe CommandAccepted(commandNumber(3))
        val offered = rig.world.events.filterIsInstance<PlayerOfferedDialogue>().single()
        offered.dialogue.speakers.mapNotNull { it.character?.value?.toString() } shouldBe listOf(figure)
    }

    "a sample that is not one is malformed, and the same offer sent twice is refused as already made" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))

        mine.receive(offering("a song", commandNumber(2)))
        (sent.last() as CommandRejected).reason shouldStartWith "malformed"

        mine.receive(offering("letter", commandNumber(3)))
        mine.receive(offering("letter", commandNumber(3)))
        sent.last() shouldBe CommandRejected(commandNumber(3), "dialogueAlreadyOffered")
        rig.world.events.filterIsInstance<PlayerOfferedDialogue>() shouldHaveSize 1
    }

    "hello also says which dialogues the house has, after what it sees, which is none before it is offered any" {
        val sent = mutableListOf<ServerFrame>()
        Rig().connect { sent += it }.receive(hello)

        sent[5] shouldBe YourDialogues(emptyList())
    }

    "an offer reaches its player as far as the dialogue choice, and not a line past it" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        mine.receive(offering("letter", commandNumber(2)))

        val told = sent.filterIsInstance<YourDialogues>().last()
        val letter = told.dialogues.single()
        letter.title shouldBe "A letter from the coast"
        letter.said shouldBe emptyList()
        letter.next.map { it.id } shouldBe listOf("arrives", "reads")
        letter.options.map { it.id } shouldBe listOf("accept", "ask", "refuse")
        // Each option shows what taking it will do as the letter was written: whole, hidden, or not at all.
        letter.options.map { it.revealImpact } shouldBe listOf(
            RevealImpactView.Shown(listOf(ImpactView("wealth", -40), ImpactView("wealth", 100))),
            RevealImpactView.Hidden,
            null,
        )
        letter.next.map { it.revealImpact } shouldBe listOf(null, null)
        letter.ending shouldBe EndingView.Open
        // Both answers' replies, and the purse, are the server's until a step reaches them, and what the letter
        // needs to stay open is the server's for good: a player learns of a requirement only when it fails.
        val onTheWire = ProtocolJson.encode(told)
        onTheWire.contains("He thought you might") shouldBe false
        onTheWire.contains("grant") shouldBe false
        onTheWire.contains("alive") shouldBe false
    }

    "each step reaches its player with what the line gave, and the end with nothing left to read" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        mine.receive(offering("letter", commandNumber(2)))
        val offered = rig.world.events.filterIsInstance<PlayerOfferedDialogue>().single()
        fun step(line: String) = rig.world.execute(
            CompleteDialogueStep(offered.houseId, offered.dialogue.id, LineId(line), today, noon),
            Provenance.startedBy(UUID.randomUUID()),
        )

        // Standing behind the quay costs forty, so the house is given it first.
        rig.world.execute(
            GrantResource(offered.houseId, Resource.WEALTH, 50, today, noon),
            Provenance.startedBy(UUID.randomUUID()),
        )
        step("accept")
        val accepted = sent.filterIsInstance<YourDialogues>().last().dialogues.single()
        accepted.said.map { it.id } shouldBe listOf("arrives", "reads", "accept")
        accepted.said.last().effects shouldBe listOf(SpendView(resource = "wealth", amount = 40))
        accepted.next.map { it.id } shouldBe listOf("paid")
        accepted.next.single().words shouldBe "He thought you might say so. The first of the dues came with me."

        step("paid")
        val paid = sent.filterIsInstance<YourDialogues>().last().dialogues.single()
        paid.said.last().effects shouldBe listOf(GrantView(resource = "wealth", amount = 100))
        paid.next shouldBe emptyList()
        paid.options shouldBe emptyList()
        paid.ending shouldBe EndingView.Completed
        paid.revision shouldBe accepted.revision + 2
    }

    "a step sent from the page continues the offer's story, and what the line does comes with it" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        mine.receive(offering("letter", commandNumber(2)))
        val offered = rig.world.events.filterIsInstance<PlayerOfferedDialogue>().single()
        val (watching, watcher) = rig.someoneElse()
        watching.receive("""{"type":"watchEvents","on":true}""")
        // A watcher is handed what it missed first. What this is about is what comes after it.
        watcher.clear()

        mine.receive(stepping(offered.dialogue.id.value.toString(), "ask", commandNumber(3)))
        mine.receive(stepping(offered.dialogue.id.value.toString(), "answer", commandNumber(4)))

        sent.last() shouldBe CommandAccepted(commandNumber(4))
        val events = watcher.filterIsInstance<EventFrame>()
        events.map { it.eventType } shouldBe listOf(
            "villages.player.completedDialogueStep.v1",
            "villages.player.completedDialogueStep.v1",
            "villages.house.resourceGranted.v1",
            "villages.player.completedDialogue.v1",
        )
        // One story, and it began with the offer: each step is caused by its own command.
        events.map { it.correlationId }.distinct() shouldBe listOf(commandNumber(2))
        events.map { it.causationId } shouldBe listOf(commandNumber(3), commandNumber(4), commandNumber(4), commandNumber(4))
        sent.filterIsInstance<YourDialogues>().last().dialogues.single().ending shouldBe EndingView.Completed
    }

    "a step the house will not take is refused under its own name, and a dialogue id that is not one as malformed" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        mine.receive(offering("letter", commandNumber(2)))
        val letter = rig.world.events.filterIsInstance<PlayerOfferedDialogue>().single().dialogue.id.value.toString()

        mine.receive(stepping(letter, "paid", commandNumber(3)))
        sent.last() shouldBe CommandRejected(commandNumber(3), "notTheNextStep")

        mine.receive(stepping(UUID.randomUUID().toString(), "accept", commandNumber(4)))
        sent.last() shouldBe CommandRejected(commandNumber(4), "noSuchDialogue")

        mine.receive(stepping("the letter", "accept", commandNumber(5)))
        (sent.last() as CommandRejected).reason shouldStartWith "malformed"

        mine.receive(stepping(letter, "refuse", commandNumber(6)))
        mine.receive(stepping(letter, "shrugs", commandNumber(7)))
        mine.receive(stepping(letter, "shrugs", commandNumber(8)))
        sent.last() shouldBe CommandRejected(commandNumber(8), "dialogueOver")
    }

    "a lost dialogue reaches its player lost, and why, ended where it stood with nothing to read or choose" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        mine.receive(offering("letter", commandNumber(2)))
        val figure = sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id
        val offered = rig.world.events.filterIsInstance<PlayerOfferedDialogue>().single()

        rig.world.execute(
            FailRequirement(offered.houseId, Requirement.Alive(CharacterId(UUID.fromString(figure))), today, noon),
            Provenance.startedBy(UUID.randomUUID()),
        )

        val lost = sent.filterIsInstance<YourDialogues>().last().dialogues.single()
        lost.ending shouldBe EndingView.Lost(RequirementView.Alive(figure))
        lost.next shouldBe emptyList()
        lost.options shouldBe emptyList()
    }

    "a line still ahead carries what it shows, and a line said carries nothing, so one read back shows nothing" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        val figure = sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id
        mine.receive(offering("letter", commandNumber(2)))
        val seat = sent.filterIsInstance<YourHouse>().last().yours!!.house.seat

        val offered = sent.filterIsInstance<YourDialogues>().last().dialogues.single()
        offered.next.map { it.shows } shouldBe listOf(ShowsView.Place(seat), null)

        mine.receive(stepping(offered.id, "ask", commandNumber(3)))
        val asked = sent.filterIsInstance<YourDialogues>().last()
        asked.dialogues.single().next.single().shows shouldBe ShowsView.Character(figure)
        // The rider's line that showed the seat is said now, and on the wire only the line ahead shows anything.
        ProtocolJson.encode(asked).split("\"shows\"").size - 1 shouldBe 1
    }

    "an option that grants or spends reaches the page as what it does, under the wire's name for the resource" {
        Effect.Grant(Resource.NATURAL_DOMAIN, 5).toView() shouldBe GrantView(resource = "naturalDomain", amount = 5)
        Effect.Spend(Resource.WEALTH, 30).toView() shouldBe SpendView(resource = "wealth", amount = 30)
    }
})
