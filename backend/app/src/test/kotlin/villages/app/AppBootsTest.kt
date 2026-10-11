package villages.app

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.client.standard.StandardWebSocketClient
import org.springframework.web.socket.handler.TextWebSocketHandler
import villages.protocol.Batch
import villages.protocol.Cell
import villages.protocol.CommandRejected
import villages.protocol.EndingView
import villages.protocol.EventFrame
import villages.protocol.ProtocolJson
import villages.protocol.RequirementView
import villages.protocol.ServerFrame
import villages.protocol.Snapshot
import villages.protocol.StructureArrived
import villages.protocol.StructureChanged
import villages.protocol.StructureView
import villages.protocol.TakenOver
import villages.protocol.FoundAtView
import villages.protocol.KeyFigureView
import villages.protocol.Welcome
import villages.protocol.PROTOCOL_VERSION
import villages.protocol.WorldWiped
import villages.protocol.YourChoice
import villages.protocol.YourDialogues
import villages.protocol.YourHoldings
import villages.protocol.YourHouse
import villages.protocol.YourKeyFigures
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.TimeUnit

/**
 * The whole process, booted, over real sockets: a house founded and its seat read back from the map, and then the
 * two rules of decision 0028 — a player has one house, and plays from one place.
 *
 * JUnit rather than Kotest here only because Spring's test support speaks JUnit.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AppBootsTest {
    @LocalServerPort
    var port: Int = 0

    /** One window: a socket, and everything the gateway has said to it. */
    private class Window(port: Int) {
        val heard = CopyOnWriteArrayList<ServerFrame>()
        private val session: WebSocketSession = StandardWebSocketClient()
            .execute(
                object : TextWebSocketHandler() {
                    override fun handleTextMessage(session: WebSocketSession, message: TextMessage) {
                        heard += ProtocolJson.decodeServer(message.payload)
                    }
                },
                "ws://localhost:$port/ws",
            )
            .get(10, TimeUnit.SECONDS)

        fun say(json: String) = session.sendMessage(TextMessage(json))

        fun close() = session.close()

        /** Waits for something to be true of what has been heard, rather than for a count of frames. */
        fun until(what: String, ready: (List<ServerFrame>) -> Boolean) {
            val giveUp = System.nanoTime() + TimeUnit.SECONDS.toNanos(10)
            while (System.nanoTime() < giveUp) {
                if (ready(heard)) return
                Thread.sleep(20)
            }
            throw AssertionError("waited for $what and never saw it; heard $heard")
        }

        inline fun <reified T : ServerFrame> last(): T = heard.filterIsInstance<T>().last()
    }

    private val token = "0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"

    /** A command id is a UUID, and the gateway refuses anything else. See decision record 0035. */
    private val founding1 = "1c000001-0000-4000-8000-00000000000a"
    private val founding2 = "1c000002-0000-4000-8000-00000000000b"
    private val takingOne = "1c000003-0000-4000-8000-00000000000c"
    private val wiping = "1c000004-0000-4000-8000-00000000000d"

    /**
     * A player of this test's own. The world is in memory and shared by every test in this class, so two
     * tests on one token would be one player, and whichever ran second would find a house already there.
     */
    private val arriving = "5e3a91c4-2b60-4f18-9d73-08ac1e6f5b27"
    private val hello = """{"type":"hello","playerToken":"$token","protocolVersion":$PROTOCOL_VERSION}"""
    private val founding =
        """{"type":"command","commandId":"$founding1","command":{"type":"foundHouse","name":"Ravenscar",""" +
            """"seat":{"lat":59.33,"lon":18.07},""" +
            """"banner":{"field":"sable","division":"plain","charge":"stag","chargeTincture":"argent"}}}"""

    /** Stockholm before the warp, at the zoom a founding's castle is worth drawing from. */
    private val cell = "12003122"

    @Test
    fun `a player arrives, takes one of the seats offered, and the house stands where it promised`() {
        val window = Window(port)
        window.say("""{"type":"watchEvents","on":true}""")
        window.say("""{"type":"hello","playerToken":"$arriving","protocolVersion":$PROTOCOL_VERSION}""")
        window.until("a choice") { frames -> frames.any { it is YourChoice } }

        val offered = window.last<YourChoice>().choice!!
        val taking = offered.options[1]
        window.say(
            """{"type":"command","commandId":"$takingOne","command":{"type":"takeAction",""" +
                """"choiceId":"${offered.id}","optionId":"${taking.id}"}}""",
        )
        window.until("the house") { frames -> frames.filterIsInstance<YourHouse>().last().yours != null }

        // The house stands where the option promised, under the name and banner it promised.
        val promised = taking.effect as FoundAtView
        val standing = window.last<YourHouse>().yours!!.house
        assertEquals(promised.name, standing.name)
        assertEquals(promised.seat, standing.seat)
        assertEquals(promised.banner, standing.banner)

        // Three events, one story: asked where, answered, and founded. The action's cause is the command. Then the
        // listeners carry it on in the same story, in whichever order they get to it: the castle raised, named the
        // seat, seen from and paid by. See 0093.
        val ours = "house:" + java.util.UUID.nameUUIDFromBytes("villages:house:$arriving".toByteArray())
        window.until("the founding, its seat, its sight and its pay") { frames ->
            frames.filterIsInstance<EventFrame>().count { it.stream == ours } >= 6
        }
        val heard = window.heard.filterIsInstance<EventFrame>()
        val events = heard.filter { it.stream == ours }.take(3)
        val seatNamed = heard.filter { it.stream == ours }.drop(3).take(3)
        val castle = "structure:" + seatNamed.first { it.eventType == "villages.house.namedSeat.v1" }.data["structureId"].asText()
        window.until("the castle") { frames -> frames.any { it is EventFrame && it.stream == castle } }
        val after = seatNamed + window.heard.filterIsInstance<EventFrame>().filter { it.stream == castle }
        assertEquals(
            setOf(
                "villages.house.namedSeat.v1", "villages.house.gainedVision.v1", "villages.house.incomeChanged.v1",
                "villages.structure.raised.v1",
            ),
            after.map { it.eventType }.toSet(),
        )
        assertEquals(setOf(events[0].correlationId), after.map { it.correlationId }.toSet(), "the founding's story: $after")
        assertEquals(
            listOf("villages.player.givenChoice.v1", "villages.player.tookAction.v1", "villages.house.founded.v1"),
            events.map { it.eventType },
        )
        assertEquals(1, events.map { it.correlationId }.distinct().size, "one story: $events")
        assertEquals(takingOne, events[1].causationId)
        assertEquals(takingOne, events[2].causationId)
        assertEquals(listOf(1L, 2L, 3L), events.map { it.streamVersion })

        // And nothing is left to decide.
        window.until("an empty parchment") { frames -> frames.filterIsInstance<YourChoice>().last().choice == null }

        window.close()
    }

    @Test
    fun `a house takes a key figure in with a portrait from the folder, and their death reaches the house`() {
        val keeper = "7d2e5f10-3c4b-4a8d-9e6f-1a2b3c4d5e6f"
        val window = Window(port)
        window.say("""{"type":"watchEvents","on":true}""")
        window.say("""{"type":"hello","playerToken":"$keeper","protocolVersion":$PROTOCOL_VERSION}""")
        window.until("the key figures") { frames -> frames.any { it is YourKeyFigures } }
        assertEquals(emptyList<KeyFigureView>(), window.last<YourKeyFigures>().keyFigures)

        // Far from every other test's house, because they share one world and some of them count a cell.
        window.say(
            """{"type":"command","commandId":"1c000005-0000-4000-8000-00000000000e","command":{"type":"foundHouse",""" +
                """"name":"Keepwell","seat":{"lat":-33.9,"lon":151.2},""" +
                """"banner":{"field":"vert","division":"plain","charge":"star","chargeTincture":"or"}}}""",
        )
        window.until("the house") { frames -> frames.filterIsInstance<YourHouse>().last().yours != null }
        val adding = "1c000006-0000-4000-8000-00000000000f"
        window.say("""{"type":"command","commandId":"$adding","command":{"type":"addKeyFigure"}}""")
        window.until("a key figure") { frames ->
            frames.filterIsInstance<YourKeyFigures>().last().keyFigures.size == 1
        }

        // Rolled by the server, with one of the portraits in world/portraits that suits them.
        val figure = window.last<YourKeyFigures>().keyFigures.single()
        assertNotNull(figure.portrait, "a portrait from the folder for $figure")
        assertTrue(figure.portrait!!.startsWith("${figure.sex}-"), "a portrait that suits them: $figure")

        // The chronicle reads in the order it happened: the newcomer appears, then the house takes them in.
        window.until("the two events") { frames -> frames.filterIsInstance<EventFrame>().count { it.causationId == adding } == 2 }
        val takenIn = window.heard.filterIsInstance<EventFrame>().filter { it.causationId == adding }
        assertEquals(listOf("villages.character.appeared.v1", "villages.house.gainedKeyFigure.v1"), takenIn.map { it.eventType })

        val killing = "1c000007-0000-4000-8000-000000000010"
        window.say(
            """{"type":"command","commandId":"$killing","command":{"type":"killCharacter",""" +
                """"characterId":"${figure.id}","cause":"struck down from the debug panel"}}""",
        )
        // Only this death's story: the window watches every event, and was shown the recent ones on arriving,
        // which can hold another test's death in the same world.
        window.until("the loss") { frames ->
            frames.filterIsInstance<EventFrame>().any {
                it.eventType == "villages.house.lostKeyFigure.v1" && it.correlationId == killing
            }
        }
        assertEquals(emptyList<KeyFigureView>(), window.last<YourKeyFigures>().keyFigures)

        // The loss the listener for character deaths writes is part of the death's story, and caused by it.
        val events = window.heard.filterIsInstance<EventFrame>().filter { it.correlationId == killing }
        val died = events.single { it.eventType == "villages.character.died.v1" }
        val lost = events.single { it.eventType == "villages.house.lostKeyFigure.v1" }
        assertEquals(died.correlationId, lost.correlationId)
        assertEquals(died.id, lost.causationId)

        window.close()
    }

    @Test
    fun `a speaker's death ends the dialogue they speak in, and the player is told it was lost, and why`() {
        val teller = "7d2e5f10-3c4b-4a8d-9e6f-1a2b3c4d5e70"
        val window = Window(port)
        window.say("""{"type":"hello","playerToken":"$teller","protocolVersion":$PROTOCOL_VERSION}""")
        window.until("the dialogues") { frames -> frames.any { it is YourDialogues } }

        // Far from every other test's house, because they share one world and some of them count a cell.
        window.say(
            """{"type":"command","commandId":"1c000008-0000-4000-8000-000000000011","command":{"type":"foundHouse",""" +
                """"name":"Tellwater","seat":{"lat":-45.0,"lon":170.5},""" +
                """"banner":{"field":"azure","division":"plain","charge":"tower","chargeTincture":"argent"}}}""",
        )
        window.until("the house") { frames -> frames.filterIsInstance<YourHouse>().last().yours != null }
        window.say("""{"type":"command","commandId":"1c000008-0000-4000-8000-000000000012","command":{"type":"addKeyFigure"}}""")
        window.until("a key figure") { frames -> frames.filterIsInstance<YourKeyFigures>().last().keyFigures.size == 1 }
        val figure = window.last<YourKeyFigures>().keyFigures.single()

        window.say(
            """{"type":"command","commandId":"1c000008-0000-4000-8000-000000000013",""" +
                """"command":{"type":"offerDialogue","sample":"letter"}}""",
        )
        window.until("the letter") { frames -> frames.filterIsInstance<YourDialogues>().last().dialogues.size == 1 }
        assertEquals(EndingView.Open, window.last<YourDialogues>().dialogues.single().ending)

        window.say(
            """{"type":"command","commandId":"1c000008-0000-4000-8000-000000000014","command":{"type":"killCharacter",""" +
                """"characterId":"${figure.id}","cause":"struck down before the letter was answered"}}""",
        )
        window.until("the loss") { frames ->
            frames.filterIsInstance<YourDialogues>().last().dialogues.single().ending is EndingView.Lost
        }
        // The one requirement the player ever learns of: the speaker who had to stay alive, and did not.
        assertEquals(
            EndingView.Lost(RequirementView.Alive(figure.id)),
            window.last<YourDialogues>().dialogues.single().ending,
        )

        window.close()
    }

    @Test
    fun `wiping the world empties it, and the next player to arrive is offered seats in a world with nothing in it`() {
        val wiper = "9f1c74b2-6a35-4e90-8c21-b7d05fe3a648"
        val wipers = "house:" + java.util.UUID.nameUUIDFromBytes("villages:house:$wiper".toByteArray())
        val first = Window(port)
        first.say("""{"type":"watchEvents","on":true}""")
        first.say("""{"type":"hello","playerToken":"$wiper","protocolVersion":$PROTOCOL_VERSION}""")
        first.until("a choice") { frames -> frames.any { it is YourChoice } }
        val offered = first.last<YourChoice>().choice!!
        first.say(
            """{"type":"command","commandId":"$wiping","command":{"type":"takeAction",""" +
                """"choiceId":"${offered.id}","optionId":"${offered.options[0].id}"}}""",
        )
        first.until("a house") { frames -> frames.filterIsInstance<YourHouse>().last().yours != null }
        // And what the listeners write after a founding - the castle, the seat, its sight - written before the wipe, so
        // none of it is still on its way to a read model as the world is emptied.
        first.until("the house's sight from its castle") { frames ->
            frames.any { it is EventFrame && it.stream == wipers && it.eventType == "villages.house.gainedVision.v1" }
        }

        first.say("""{"type":"wipeWorld"}""")
        first.until("being told the world went") { frames -> frames.any { it is WorldWiped } }

        // Arriving again, in a world with nothing in it: no house, and the founding choice afresh.
        val second = Window(port)
        second.say("""{"type":"watchEvents","on":true}""")
        second.say("""{"type":"hello","playerToken":"$wiper","protocolVersion":$PROTOCOL_VERSION}""")
        second.until("a choice again") { frames -> frames.any { it is YourChoice } }

        assertNull(second.last<YourHouse>().yours, "the house went with the world")
        assertNotNull(second.last<YourChoice>().choice, "a player with no house is asked where to found")
        // The first event of the stream again, which is what proves the store was emptied and not hidden.
        // Its own stream's, because the server is shared and another test's listeners may still be writing for theirs.
        // The choice asked again is the stream's first event, which it is only in a store that was emptied. Looked for by
        // its type, because the event page's recent events can still take in one written just before the wipe: the
        // wipe's race with events in flight, a task of its own.
        val choiceAgain = { frame: Any -> frame is EventFrame && frame.stream == wipers && frame.eventType == "villages.player.givenChoice.v1" }
        second.until("the choice event") { frames -> frames.any(choiceAgain) }
        assertEquals(1L, second.heard.filterIsInstance<EventFrame>().last(choiceAgain).streamVersion)

        first.close()
        second.close()
    }

    @Test
    fun `a house is founded, read back from the map, and belongs to the one player who plays from one place`() {
        val first = Window(port)
        first.say(hello)
        // Welcome, the house and the choice are three frames: wait for all of them.
        first.until("a welcome, a house and a choice") { frames ->
            frames.any { it is Welcome } && frames.any { it is YourHouse } && frames.any { it is YourChoice }
        }
        assertNull(first.last<YourHouse>().yours, "a new player has no house yet")

        // Arriving with no house is answered with three seats to choose between.
        val offered = first.last<YourChoice>().choice
        assertNotNull(offered, "a new player is asked where to found")
        assertEquals(3, offered!!.options.size)
        assertEquals(3, offered.options.map { it.label.substringAfter(", in ") }.distinct().size)

        // The stream is worked out from the player, not chosen by the client: see HouseId.of. Its own is listened for,
        // because the server is shared and another test's listeners may still be writing for theirs.
        val founders = "house:49d14206-e7b6-3cff-b12c-0fa929182509"
        val founded = { frame: Any -> frame is EventFrame && frame.stream == founders && frame.eventType == "villages.house.founded.v1" }
        first.say("""{"type":"watchEvents","on":true}""")
        first.say(founding)
        first.until("the event and the house") { frames ->
            frames.any(founded) && frames.filterIsInstance<YourHouse>().last().yours != null
        }
        assertEquals("Ravenscar", first.last<YourHouse>().yours?.house?.name)

        // A house is not drawn on the map: its castle is, its seat, raised and named by listeners a moment after.
        first.until("the castle, the house's seat") { frames ->
            frames.filterIsInstance<YourHoldings>().lastOrNull()?.holdings.orEmpty().any { it.seatOf?.name == "Ravenscar" }
        }
        first.say("""{"type":"subscribeCells","cells":["$cell"]}""")
        first.until("a snapshot") { frames -> frames.any { it is Snapshot } }
        val snapshot = first.last<Snapshot>()
        assertEquals(cell, snapshot.cell)
        assertEquals(listOf("Ravenscar Castle"), snapshot.structures.filter { it.seatOf?.name == "Ravenscar" }.map { it.name })

        // A second window of the same player takes over, and is told the house is already theirs.
        val second = Window(port)
        second.say(hello)
        second.until("the house on hello") { frames -> frames.filterIsInstance<YourHouse>().isNotEmpty() }
        assertEquals("Ravenscar", second.last<YourHouse>().yours?.house?.name)

        first.until("being stood down") { frames -> frames.any { it is TakenOver } }
        assertNotNull(first.last<TakenOver>().message)

        // And there is still one house: founding again is refused, whichever window asks.
        second.say("""{"type":"command","commandId":"$founding2","command":{"type":"foundHouse","name":"Another",""" +
            """"seat":{"lat":59.33,"lon":18.07},""" +
            """"banner":{"field":"or","division":"plain","charge":"star","chargeTincture":"azure"}}}""")
        second.until("a refusal") { frames -> frames.any { it is CommandRejected } }
        assertEquals("alreadyFounded", second.last<CommandRejected>().reason)

        second.say("""{"type":"subscribeCells","cells":["$cell"]}""")
        second.until("a snapshot") { frames -> frames.any { it is Snapshot } }
        assertEquals(1, second.last<Snapshot>().structures.count { it.seatOf != null }, "one player, one house, one seat")

        first.close()
        second.close()
    }
    @Test
    fun `two players are each sent what reaches them, one founding a house where the other is looking`() {
        // Sent on the gateway's own threads, as the app wires it: see decision record 0077. In Helsinki, where no
        // other test looks, because the world is one for every test here.
        val helsinki = Cell.of(60.17, 24.94).at(8).quadkey
        val looking = Window(port)
        looking.say("""{"type":"hello","playerToken":"${UUID.randomUUID()}","protocolVersion":$PROTOCOL_VERSION}""")
        looking.until("a welcome") { frames -> frames.any { it is Welcome } }
        looking.say("""{"type":"fogOfWar","on":false}""")
        looking.say("""{"type":"subscribeCells","cells":["$helsinki"]}""")
        looking.until("a snapshot") { frames -> frames.any { it is Snapshot } }

        val founding = Window(port)
        founding.say("""{"type":"hello","playerToken":"${UUID.randomUUID()}","protocolVersion":$PROTOCOL_VERSION}""")
        founding.until("a welcome") { frames -> frames.any { it is Welcome } }
        founding.say(
            """{"type":"command","commandId":"${UUID.randomUUID()}","command":{"type":"foundHouse","name":"Hollin",""" +
                """"seat":{"lat":60.17,"lon":24.94},""" +
                """"banner":{"field":"vert","division":"plain","charge":"tower","chargeTincture":"or"}}}""",
        )
        founding.until("its own house") { frames -> frames.filterIsInstance<YourHouse>().lastOrNull()?.yours != null }

        // The house is not drawn, its seat is: the castle arrives, and is named the seat a moment after.
        looking.until("the house's seat appearing where it looks") { frames ->
            frames.filterIsInstance<Batch>().flatMap { it.deltas }.any { delta ->
                val structure: StructureView? = (delta as? StructureArrived)?.structure ?: (delta as? StructureChanged)?.structure
                structure?.seatOf?.name == "Hollin"
            }
        }

        looking.close()
        founding.close()
    }
}
