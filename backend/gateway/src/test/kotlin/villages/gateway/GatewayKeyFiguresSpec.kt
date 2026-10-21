package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import villages.protocol.Batch
import villages.protocol.CharacterArrived
import villages.protocol.CharacterChanged
import villages.protocol.CharacterGone
import villages.protocol.CommandAccepted
import villages.protocol.CommandRejected
import villages.protocol.Point
import villages.protocol.ServerFrame
import villages.protocol.Snapshot
import villages.protocol.StatsView
import villages.protocol.YourKeyFigures

/** The gateway: the house's key figures, the levers on them, and characters on the map. The rig is GatewayRig.kt. */
class GatewayKeyFiguresSpec : StringSpec({

    "hello also says which key figures the house holds, which is none before it holds any" {
        val sent = mutableListOf<ServerFrame>()
        Rig().connect { sent += it }.receive(hello)

        sent[2] shouldBe YourKeyFigures(emptyList())
    }

    "a house takes a key figure in, and its player is told who they are, stats and all" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        sent.clear()

        mine.receive(addingAKeyFigure(commandNumber(1)))

        sent.filterIsInstance<CommandAccepted>().single().commandId shouldBe commandNumber(1)
        val agnes = sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single()
        agnes.givenName shouldBe "Agnes"
        agnes.familyName shouldBe "Achterberg"
        agnes.sex shouldBe "woman"
        agnes.species shouldBe "person"
        agnes.stats shouldBe StatsView(piety = 3, reason = 3, kindness = 3, physical = 3)
        agnes.portrait shouldBe "woman-01"
        agnes.keyFigureOf.single().name shouldBe "Ravenscar"
    }

    "a lever on one of the house's own key figures changes what its player is told" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        val agnes = sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id

        mine.receive(changingStat(agnes, "piety", 2, commandNumber(2)))

        sent.filterIsInstance<CommandAccepted>().last().commandId shouldBe commandNumber(2)
        sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().stats.piety shouldBe 5
    }

    "a lever on somebody else's key figure is refused as not one of the house's own" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        val agnes = sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id
        val (theirs, told) = rig.someoneElse()
        theirs.receive(founding(name = "Hollin"))

        theirs.receive(changingStat(agnes, "piety", 2, commandNumber(2)))

        told.filterIsInstance<CommandRejected>().single().reason shouldBe "noSuchKeyFigure"
        sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().stats.piety shouldBe 3
    }

    "a stat the wire does not know is refused as malformed" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        val agnes = sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id

        mine.receive(changingStat(agnes, "luck", 2, commandNumber(2)))

        sent.filterIsInstance<CommandRejected>().single().reason shouldBe "malformed: not a stat: luck"
    }

    "a key figure killed leaves the list at once" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        val agnes = sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id

        mine.receive(killing(agnes, commandNumber(2)))

        sent.filterIsInstance<CommandAccepted>().last().commandId shouldBe commandNumber(2)
        sent.filterIsInstance<YourKeyFigures>().last().keyFigures.shouldBeEmpty()
    }

    "a key figure moved onto the map arrives for whoever holds their cell, and their player is told where" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        val agnes = sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id
        val (looker, seen) = rig.someoneElse(fogLifted = true)
        looker.receive(subscribe(STOCKHOLM_Z10))
        val (far, farSeen) = rig.someoneElse(fogLifted = true)
        // Zoom 4 is coarser than anything on the map is drawn at, which is zoom 7 (0096).
        far.receive(subscribe(STOCKHOLM_Z4))
        rig.later.tick()
        seen.clear()
        farSeen.clear()

        mine.receive(moving(agnes, 59.34, 18.06, commandNumber(2)))
        rig.later.tick()

        sent.filterIsInstance<CommandAccepted>().last().commandId shouldBe commandNumber(2)
        sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().place shouldBe Point(59.34, 18.06)
        val arrived = seen.filterIsInstance<Batch>().single().deltas.single().shouldBeInstanceOf<CharacterArrived>()
        arrived.character.givenName shouldBe "Agnes"
        arrived.character.cell shouldBe STOCKHOLM_Z10
        arrived.character.keyFigureOf.single().name shouldBe "Ravenscar"
        farSeen.filterIsInstance<Batch>().flatMap { it.deltas }.shouldBeEmpty()
    }

    // A house never moves, so a client never had to drop one; a character does, and has to be told.

    "a character moving within the cells held is changed, and moving out of them is gone" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        val agnes = sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id
        val (looker, seen) = rig.someoneElse(fogLifted = true)
        looker.receive(subscribe(STOCKHOLM_Z10))
        mine.receive(moving(agnes, 59.34, 18.06, commandNumber(2)))
        rig.later.tick()
        seen.clear()

        mine.receive(moving(agnes, 59.335, 18.065, commandNumber(3)))
        rig.later.tick()
        seen.filterIsInstance<Batch>().single().deltas.single().shouldBeInstanceOf<CharacterChanged>()
        seen.clear()

        mine.receive(moving(agnes, 60.17, 24.94, commandNumber(4)))
        rig.later.tick()
        seen.filterIsInstance<Batch>().single().deltas.single().shouldBeInstanceOf<CharacterGone>().id shouldBe agnes
    }

    "taking a key figure off the map is gone for whoever held them, and a stat change tells the map nothing" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        val agnes = sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id
        val (looker, seen) = rig.someoneElse(fogLifted = true)
        looker.receive(subscribe(STOCKHOLM_Z10))
        mine.receive(moving(agnes, 59.34, 18.06, commandNumber(2)))
        rig.later.tick()
        seen.clear()

        mine.receive(changingStat(agnes, "piety", 2, commandNumber(3)))
        rig.later.tick()
        seen.shouldBeEmpty()

        mine.receive(takingOff(agnes, commandNumber(4)))
        rig.later.tick()
        seen.filterIsInstance<Batch>().single().deltas.single().shouldBeInstanceOf<CharacterGone>()
        sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().place shouldBe null
    }

    "a cell's snapshot carries the characters standing in it" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        val agnes = sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id
        mine.receive(moving(agnes, 59.34, 18.06, commandNumber(2)))
        val (looker, seen) = rig.someoneElse(fogLifted = true)

        looker.receive(subscribe(STOCKHOLM_Z10))

        val snapshot = seen.filterIsInstance<Snapshot>().single()
        snapshot.characters.single().id shouldBe agnes
        snapshot.characters.single().place shouldBe Point(59.34, 18.06)
        snapshot.omittedCharacters shouldBe 0
    }

    "moving somebody else's key figure is refused, and so is a place off the world" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        val agnes = sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id
        val (theirs, told) = rig.someoneElse()
        theirs.receive(founding(name = "Hollin"))

        theirs.receive(moving(agnes, 59.34, 18.06, commandNumber(2)))
        mine.receive(moving(agnes, 95.0, 18.06, commandNumber(3)))
        mine.receive(takingOff(agnes, commandNumber(4)))

        told.filterIsInstance<CommandRejected>().single().reason shouldBe "noSuchKeyFigure"
        sent.filterIsInstance<CommandRejected>().map { it.reason } shouldBe listOf("invalidLocation", "notOnTheMap")
    }

    "a tenth key figure is refused, because a house holds nine" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        (1..9).forEach { mine.receive(addingAKeyFigure(commandNumber(it))) }

        mine.receive(addingAKeyFigure(commandNumber(10)))

        sent.filterIsInstance<CommandRejected>().single().reason shouldBe "tooManyKeyFigures"
        sent.filterIsInstance<YourKeyFigures>().last().keyFigures shouldHaveSize 9
    }
})
