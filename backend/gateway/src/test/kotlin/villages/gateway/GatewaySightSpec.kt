package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.ints.shouldBeLessThan
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import villages.domain.HouseId
import villages.domain.PlayerId
import villages.domain.StructureId
import villages.protocol.Batch
import villages.protocol.CharacterArrived
import villages.protocol.CharacterGone
import villages.protocol.CommandAccepted
import villages.protocol.CommandRejected
import villages.protocol.Point
import villages.protocol.ServerFrame
import villages.protocol.Snapshot
import villages.protocol.StructureArrived
import villages.protocol.VisionPointView
import villages.protocol.YourKeyFigures
import villages.protocol.YourSight
import java.util.UUID

/** The gateway: what a house sees, and what the fog of war holds back. The rig is GatewayRig.kt. */
class GatewaySightSpec : StringSpec({

    "hello also says what the house sees from, which is nowhere before there is a house" {
        val sent = mutableListOf<ServerFrame>()
        Rig().gateway.connect { sent += it }.receive(hello)

        sent[4] shouldBe YourSight(emptyList(), tension = 40.0)
    }

    "founding gives no vision of its own: the house sees from its castle once it is raised, and its player is told" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()

        mine.receive(founding())
        sent.filterIsInstance<YourSight>().shouldBeEmpty()

        rig.settle()

        val castle = StructureId.seatOf(HouseId.of(PlayerId(UUID.fromString(TOKEN))))
        val seen = sent.filterIsInstance<YourSight>().last().points.single()
        listOf(seen.kind, seen.place, seen.radius, seen.since, seen.until, seen.from) shouldBe
            listOf("given", Point(59.33, 18.07), 34.0, today.day, null, castle.value.toString())
    }

    "a key figure put on the map gives vision there, and moving them closes that point and opens the next" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        val agnes = sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id

        mine.receive(moving(agnes, 59.86, 17.64, commandNumber(2)))
        mine.receive(moving(agnes, 57.64, 18.30, commandNumber(3)))

        sent.filterIsInstance<YourSight>().last().points shouldBe listOf(
            VisionPointView("keyFigure", agnes, Point(59.86, 17.64), 34.0, since = today.day, until = today.day),
            VisionPointView("keyFigure", agnes, Point(57.64, 18.30), 34.0, since = today.day),
        )
    }

    "vision given outright is a vision point of its own, and taking it away closes it" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())

        mine.receive(givingVision(57.64, 18.30, commandNumber(1)))
        val given = sent.filterIsInstance<YourSight>().last().points.last()
        given.kind shouldBe "given"
        given.place shouldBe Point(57.64, 18.30)
        given.radius shouldBe 34.0
        given.until shouldBe null

        mine.receive(takingVision(given.of!!, commandNumber(2)))
        sent.filterIsInstance<CommandAccepted>().map { it.commandId } shouldContain commandNumber(2)
        sent.filterIsInstance<YourSight>().last().points.last() shouldBe given.copy(until = today.day)
    }

    "a vision the house was never given cannot be taken away" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())

        mine.receive(takingVision("dd000000-0000-4000-8000-000000000099", commandNumber(1)))

        sent.filterIsInstance<CommandRejected>().single() shouldBe CommandRejected(commandNumber(1), "noSuchVision")
    }

    "what one house sees is told to its own player and to nobody else" {
        val rig = Rig()
        val (looker, seen) = rig.someoneElse()
        val (mine, _) = rig.introduced()

        mine.receive(founding())

        seen.filterIsInstance<YourSight>().shouldBeEmpty()
        looker.cells().shouldBeEmpty()
    }

    "the fog holds back a structure on ground the player's house has never seen, and lifting it sends it" {
        val rig = Rig()
        rig.aStructureIsRaised("castle", HELSINKI_LAT, HELSINKI_LON)
        rig.aStructureIsRaised("mill")
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        rig.settle()
        sent.clear()

        mine.receive(subscribe(HELSINKI_Z10, STOCKHOLM_Z10))

        val fogged = sent.filterIsInstance<Snapshot>().associateBy { it.cell }
        fogged.getValue(HELSINKI_Z10).structures.shouldBeEmpty()
        // What is hidden is not counted either, because how much is hidden is itself something learnt.
        fogged.getValue(HELSINKI_Z10).omittedStructures shouldBe 0
        fogged.getValue(STOCKHOLM_Z10).structures.map { it.name }.sorted() shouldBe listOf("Ravenscar Castle", "a new mill")
        sent.clear()

        mine.receive(fogOfWar(false))
        sent.filterIsInstance<Snapshot>().single { it.cell == HELSINKI_Z10 }.structures.single().name shouldBe "a new castle"
        sent.clear()

        mine.receive(fogOfWar(false))
        sent.shouldBeEmpty()

        mine.receive(fogOfWar(true))
        sent.filterIsInstance<Snapshot>().single { it.cell == HELSINKI_Z10 }.structures.shouldBeEmpty()
    }

    "a structure arrives with the vision given over it, before which the page is told the new sight, and stays once it is taken away" {
        val rig = Rig()
        rig.aStructureIsRaised("castle", HELSINKI_LAT, HELSINKI_LON)
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(subscribe(HELSINKI_Z10))
        sent.clear()

        mine.receive(givingVision(HELSINKI_LAT, HELSINKI_LON, commandNumber(1)))

        sent.filterIsInstance<Snapshot>().single().structures.single().name shouldBe "a new castle"
        sent.indexOfFirst { it is YourSight } shouldBeLessThan sent.indexOfFirst { it is Snapshot }
        val given = sent.filterIsInstance<YourSight>().last().points.last().of!!
        sent.clear()

        mine.receive(takingVision(given, commandNumber(2)))

        // Revealed ground keeps its buildings: what stands still is still known, as of the day the fog hid it.
        val kept = sent.filterIsInstance<Snapshot>().single().structures.single()
        kept.name shouldBe "a new castle"
        kept.seenUntil shouldBe today.day
    }

    "somebody is sent only while they stand in vision, and not on ground that is only revealed" {
        val rig = Rig()
        val (theirs, told) = rig.someoneElse()
        theirs.receive(founding(name = "Kestrel", lat = HELSINKI_LAT, lon = HELSINKI_LON))
        theirs.receive(addingAKeyFigure(commandNumber(1)))
        val agnes = told.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id
        theirs.receive(moving(agnes, HELSINKI_LAT, HELSINKI_LON, commandNumber(2)))
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(givingVision(HELSINKI_LAT, HELSINKI_LON, commandNumber(3)))
        val given = sent.filterIsInstance<YourSight>().last().points.last().of!!
        sent.clear()

        mine.receive(subscribe(HELSINKI_Z10))
        sent.filterIsInstance<Snapshot>().single().characters.single().id shouldBe agnes
        sent.clear()

        mine.receive(takingVision(given, commandNumber(4)))

        val revealed = sent.filterIsInstance<Snapshot>().single()
        revealed.characters.shouldBeEmpty()
        revealed.omittedCharacters shouldBe 0
    }

    "a structure raised on ground the player has never seen is not told to them, and one in their vision is" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        rig.settle()
        mine.receive(subscribe(HELSINKI_Z10, STOCKHOLM_Z10))
        rig.later.tick()
        sent.clear()

        rig.aStructureIsRaised("castle", HELSINKI_LAT, HELSINKI_LON)
        rig.aStructureIsRaised("mill", 59.34, 18.06)
        rig.later.tick()

        sent.filterIsInstance<Batch>().flatMap { it.deltas }
            .map { it.shouldBeInstanceOf<StructureArrived>().structure.name } shouldBe listOf("a new mill")
    }

    "somebody walking into the house's vision arrives, and walking out of it is gone" {
        val rig = Rig()
        val (theirs, told) = rig.someoneElse()
        theirs.receive(founding(name = "Kestrel", lat = HELSINKI_LAT, lon = HELSINKI_LON))
        theirs.receive(addingAKeyFigure(commandNumber(1)))
        val agnes = told.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        rig.settle()
        mine.receive(subscribe(STOCKHOLM_Z10, HELSINKI_Z10))
        rig.later.tick()
        sent.clear()

        // Standing in a cell the player holds, on ground their house has never seen.
        theirs.receive(moving(agnes, HELSINKI_LAT, HELSINKI_LON, commandNumber(2)))
        rig.later.tick()
        sent.filterIsInstance<Batch>().flatMap { it.deltas }.shouldBeEmpty()

        theirs.receive(moving(agnes, 59.34, 18.06, commandNumber(3)))
        rig.later.tick()
        sent.filterIsInstance<Batch>().single().deltas.single()
            .shouldBeInstanceOf<CharacterArrived>().character.id shouldBe agnes
        sent.clear()

        theirs.receive(moving(agnes, HELSINKI_LAT, HELSINKI_LON, commandNumber(4)))
        rig.later.tick()
        sent.filterIsInstance<Batch>().single().deltas.single().shouldBeInstanceOf<CharacterGone>().id shouldBe agnes
    }

    "a player's own key figure reaches them wherever they walk, without waiting for the sight to follow" {
        val rig = Rig()
        val (mine, sent) = rig.introduced()
        mine.receive(founding())
        mine.receive(addingAKeyFigure(commandNumber(1)))
        val agnes = sent.filterIsInstance<YourKeyFigures>().last().keyFigures.single().id
        mine.receive(subscribe(HELSINKI_Z10))
        rig.later.tick()
        sent.clear()

        mine.receive(moving(agnes, HELSINKI_LAT, HELSINKI_LON, commandNumber(2)))
        rig.later.tick()

        // As a delta, and not only in the cell answered again once the sight has caught up with her.
        sent.filterIsInstance<Batch>().single().deltas.single()
            .shouldBeInstanceOf<CharacterArrived>().character.id shouldBe agnes
    }
})
