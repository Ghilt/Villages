package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import villages.protocol.Batch
import villages.protocol.ErrorFrame
import villages.protocol.HouseAppeared
import villages.protocol.Resync
import villages.protocol.ServerFrame
import villages.protocol.Snapshot
import villages.protocol.TakenOver

/** The gateway: holding cells: snapshots, deltas, the eye, and a connection that falls behind or goes away. The rig is GatewayRig.kt. */
class GatewayCellsSpec : StringSpec({

    "subscribing to a cell answers with a snapshot of what is there, at every zoom it is worth drawing at" {
        val rig = Rig()
        val (founder, _) = rig.someoneElse()
        founder.receive(founding())
        val (looker, sent) = rig.introduced(fogLifted = true)

        looker.receive(subscribe(STOCKHOLM_Z10, STOCKHOLM_Z8, STOCKHOLM_Z4))

        val snapshots = sent.map { it.shouldBeInstanceOf<Snapshot>() }
        snapshots.map { it.cell } shouldContainExactly listOf(STOCKHOLM_Z10, STOCKHOLM_Z8, STOCKHOLM_Z4)
        // A founding is worth drawing from zoom eight in; the zoom-four cell is honestly empty.
        snapshots[0].houses.map { it.name } shouldBe listOf("Ravenscar")
        snapshots[0].houses.single().cell shouldBe STOCKHOLM_Z10
        snapshots[1].houses shouldHaveSize 1
        snapshots[2].houses.shouldBeEmpty()
        snapshots.all { it.omitted == 0 } shouldBe true
    }

    "a house founded after subscribing arrives as a delta, once the batch closes" {
        val rig = Rig()
        val (looker, sent) = rig.introduced(fogLifted = true)
        looker.receive(subscribe(STOCKHOLM_Z8))
        sent.clear()
        val (founder, _) = rig.someoneElse()

        founder.receive(founding())
        sent.shouldBeEmpty()
        rig.later.tick()

        val batch = sent.single().shouldBeInstanceOf<Batch>()
        val appeared = batch.deltas.single().shouldBeInstanceOf<HouseAppeared>()
        appeared.house.name shouldBe "Ravenscar"
        // Version two, behind the choice this player was given, and it still appears rather than changes:
        // whether a house is new is the read model's answer and not the stream version's.
        appeared.house.version shouldBe 2
    }

    "a house that reaches a connection through two of its cells is sent once" {
        val rig = Rig()
        val (looker, sent) = rig.introduced(fogLifted = true)
        looker.receive(subscribe(STOCKHOLM_Z10, STOCKHOLM_Z8))
        sent.clear()
        val (founder, _) = rig.someoneElse()

        founder.receive(founding())
        rig.later.tick()

        sent.single().shouldBeInstanceOf<Batch>().deltas shouldHaveSize 1
    }

    "a house too ordinary for a coarse cell does not reach a connection holding only that cell" {
        val rig = Rig()
        val (looker, sent) = rig.introduced(fogLifted = true)
        looker.receive(subscribe(STOCKHOLM_Z4))
        sent.clear()
        val (founder, _) = rig.someoneElse()

        founder.receive(founding())
        rig.later.tick()

        sent.shouldBeEmpty()
    }

    "with the eye open a house too ordinary for a coarse cell is in its snapshot after all" {
        val rig = Rig()
        rig.aHouseIsFounded("Ravenscar")
        val (looker, sent) = rig.introduced(fogLifted = true)

        looker.receive(subscribe(STOCKHOLM_Z4))
        sent.filterIsInstance<Snapshot>().single().houses.shouldBeEmpty()
        sent.clear()

        looker.receive(seeAll(true))

        // Every held cell is answered again, so the map redraws at once rather than at the next pan.
        val snapshot = sent.filterIsInstance<Snapshot>().single()
        snapshot.cell shouldBe STOCKHOLM_Z4
        snapshot.houses.single().name shouldBe "Ravenscar"
    }

    "with the eye open a founding reaches a connection holding only a coarse cell" {
        val rig = Rig()
        val (looker, sent) = rig.introduced(fogLifted = true)
        looker.receive(subscribe(STOCKHOLM_Z4))
        looker.receive(seeAll(true))
        sent.clear()
        val (founder, _) = rig.someoneElse()

        founder.receive(founding())
        rig.later.tick()

        val batch = sent.single().shouldBeInstanceOf<Batch>()
        batch.deltas.single().shouldBeInstanceOf<HouseAppeared>().house.name shouldBe "Ravenscar"
    }

    "closing the eye answers the held cells again, and they are empty once more" {
        val rig = Rig()
        rig.aHouseIsFounded("Ravenscar")
        val (looker, sent) = rig.introduced(fogLifted = true)
        looker.receive(subscribe(STOCKHOLM_Z4))
        looker.receive(seeAll(true))
        sent.clear()

        looker.receive(seeAll(false))

        sent.filterIsInstance<Snapshot>().single().houses.shouldBeEmpty()
    }

    "opening the eye twice says nothing the second time" {
        val rig = Rig()
        val (looker, sent) = rig.introduced()
        looker.receive(subscribe(STOCKHOLM_Z4))
        looker.receive(seeAll(true))
        sent.clear()

        looker.receive(seeAll(true))

        sent.shouldBeEmpty()
    }

    "several foundings in a quarter second are one batch" {
        val rig = Rig()
        val (looker, sent) = rig.introduced(fogLifted = true)
        looker.receive(subscribe(STOCKHOLM_Z8))
        sent.clear()

        rig.aHouseIsFounded("One")
        rig.aHouseIsFounded("Two")
        rig.aHouseIsFounded("Three")
        rig.later.pending shouldBe 1
        rig.later.tick()

        sent.single().shouldBeInstanceOf<Batch>().deltas shouldHaveSize 3
    }

    "a connection that unsubscribed hears nothing more about the cell" {
        val rig = Rig()
        val (looker, sent) = rig.introduced(fogLifted = true)
        looker.receive(subscribe(STOCKHOLM_Z8))
        looker.receive(unsubscribe(STOCKHOLM_Z8))
        sent.clear()
        val (founder, _) = rig.someoneElse()

        founder.receive(founding())
        rig.later.tick()

        sent.shouldBeEmpty()
        looker.cells().shouldBeEmpty()
    }

    "a connection that went away is forgotten by every cell it held" {
        val rig = Rig()
        val (looker, sent) = rig.introduced(fogLifted = true)
        looker.receive(subscribe(STOCKHOLM_Z8))
        looker.disconnected()
        sent.clear()
        val (founder, _) = rig.someoneElse()

        founder.receive(founding())
        rig.later.tick()

        sent.shouldBeEmpty()
    }

    // The founder's own house is sent to them before anyone holding its cell is told, so a throw there used
    // to leave the fan-out with nobody told. Seeding closes each connection as its command is accepted.

    "a founder whose socket is closing does not cost whoever holds the cell the house appearing" {
        val rig = Rig()
        val (looker, sent) = rig.introduced(fogLifted = true)
        looker.receive(subscribe(STOCKHOLM_Z8))
        sent.clear()
        val founder = rig.someoneLeaving()

        founder.receive(founding())
        rig.later.tick()

        val batch = sent.single().shouldBeInstanceOf<Batch>()
        batch.deltas.single().shouldBeInstanceOf<HouseAppeared>().house.name shouldBe "Ravenscar"
    }

    "more cells than a connection may hold is refused, and none of them taken" {
        val (looker, sent) = Rig().introduced()
        val tooMany = (0 until MOST_CELLS + 1).map { it.toString(4).padStart(4, '0') }

        looker.receive(subscribe(*tooMany.toTypedArray()))

        sent.single().shouldBeInstanceOf<ErrorFrame>().code shouldBe "tooManyCells"
        looker.cells().shouldBeEmpty()
    }

    "something that is not a cell is refused" {
        val (looker, sent) = Rig().introduced()

        looker.receive(subscribe("12", "4"))
        looker.receive(subscribe("00000000000"))

        sent.map { it.shouldBeInstanceOf<ErrorFrame>().code } shouldBe listOf("badCell", "badCell")
        looker.cells().shouldBeEmpty()
    }

    "a connection that falls too far behind is told to ask for its cells again, and the backlog is dropped" {
        val rig = Rig()
        val (looker, sent) = rig.introduced(fogLifted = true)
        looker.receive(subscribe(STOCKHOLM_Z8))
        sent.clear()

        repeat(MOST_WAITING + 1) { index -> rig.aHouseIsFounded("H$index") }

        sent.single() shouldBe Resync(listOf(STOCKHOLM_Z8))
        rig.later.tick()
        // Nothing more: the backlog went with the resync, and so did the cell, so asking again gets a snapshot.
        sent shouldHaveSize 1
        looker.cells().shouldBeEmpty()
        looker.receive(subscribe(STOCKHOLM_Z8))
        sent.last().shouldBeInstanceOf<Snapshot>().houses shouldHaveSize MOST_IN_A_CELL
    }

    "a connection taken over while it is answered for its cells holds none of them after, and hears of nothing" {
        val rig = Rig()
        val sent = mutableListOf<ServerFrame>()
        var tookOver = false
        val first = rig.gateway.connect { frame ->
            sent += frame
            // The player's other window says hello while this one is still being answered for what it asked.
            if (frame is Snapshot && !tookOver) {
                tookOver = true
                rig.introduced()
            }
        }
        first.receive(hello)
        first.receive(fogOfWar(false))
        first.receive(subscribe(STOCKHOLM_Z4, STOCKHOLM_Z8, STOCKHOLM_Z10))
        sent.filterIsInstance<TakenOver>() shouldHaveSize 1
        sent.clear()

        rig.aHouseIsFounded()
        rig.later.tick()

        sent.shouldBeEmpty()
    }

    "a cell nobody holds any more leaves the index" {
        val rig = Rig()
        val (looker, _) = rig.introduced()
        looker.receive(subscribe(STOCKHOLM_Z8, STOCKHOLM_Z10))
        looker.receive(unsubscribe(STOCKHOLM_Z8, STOCKHOLM_Z10))

        rig.gateway.cellsHeld shouldBe 0
    }
})
