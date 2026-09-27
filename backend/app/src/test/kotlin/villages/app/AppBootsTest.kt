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
import villages.protocol.CommandRejected
import villages.protocol.EventFrame
import villages.protocol.ProtocolJson
import villages.protocol.ServerFrame
import villages.protocol.Snapshot
import villages.protocol.TakenOver
import villages.protocol.FoundAtView
import villages.protocol.KeyFigureView
import villages.protocol.Welcome
import villages.protocol.PROTOCOL_VERSION
import villages.protocol.WorldWiped
import villages.protocol.YourChoice
import villages.protocol.YourHouse
import villages.protocol.YourKeyFigures
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.TimeUnit

/**
 * The whole process, booted, over real sockets: a house founded and read back from the map, and then the
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

    /** Stockholm before the warp, at the zoom a founding is worth drawing from. */
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

        // Three events, one story: asked where, answered, and founded. The action's cause is the command.
        val ours = "house:" + java.util.UUID.nameUUIDFromBytes("villages:house:$arriving".toByteArray())
        window.until("three events") { frames ->
            frames.filterIsInstance<EventFrame>().count { it.stream == ours } == 3
        }
        val events = window.heard.filterIsInstance<EventFrame>().filter { it.stream == ours }
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
        window.until("the loss") { frames ->
            frames.filterIsInstance<EventFrame>().any { it.eventType == "villages.house.lostKeyFigure.v1" }
        }
        assertEquals(emptyList<KeyFigureView>(), window.last<YourKeyFigures>().keyFigures)

        // The loss the listener for character deaths writes is part of the death's story, and caused by it.
        val events = window.heard.filterIsInstance<EventFrame>()
        val died = events.single { it.eventType == "villages.character.died.v1" }
        val lost = events.single { it.eventType == "villages.house.lostKeyFigure.v1" }
        assertEquals(died.correlationId, lost.correlationId)
        assertEquals(died.id, lost.causationId)

        window.close()
    }

    @Test
    fun `wiping the world empties it, and the next player to arrive is offered seats in a world with nothing in it`() {
        val wiper = "9f1c74b2-6a35-4e90-8c21-b7d05fe3a648"
        val first = Window(port)
        first.say("""{"type":"hello","playerToken":"$wiper","protocolVersion":$PROTOCOL_VERSION}""")
        first.until("a choice") { frames -> frames.any { it is YourChoice } }
        val offered = first.last<YourChoice>().choice!!
        first.say(
            """{"type":"command","commandId":"$wiping","command":{"type":"takeAction",""" +
                """"choiceId":"${offered.id}","optionId":"${offered.options[0].id}"}}""",
        )
        first.until("a house") { frames -> frames.filterIsInstance<YourHouse>().last().yours != null }

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
        second.until("the choice event") { frames -> frames.any { it is EventFrame } }
        assertEquals(1L, second.heard.filterIsInstance<EventFrame>().first().streamVersion)

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

        first.say("""{"type":"watchEvents","on":true}""")
        first.say(founding)
        first.until("the event and the house") { frames ->
            frames.any { it is EventFrame } && frames.filterIsInstance<YourHouse>().last().yours != null
        }

        // The founding choice this player was given came first, and the founding follows it.
        val event = first.heard.filterIsInstance<EventFrame>().last()
        assertEquals("villages.house.founded.v1", event.eventType)
        // The stream is worked out from the player, not chosen by the client: see HouseId.of.
        assertEquals("house:49d14206-e7b6-3cff-b12c-0fa929182509", event.stream)
        assertEquals("Ravenscar", first.last<YourHouse>().yours?.house?.name)

        first.say("""{"type":"subscribeCells","cells":["$cell"]}""")
        first.until("a snapshot") { frames -> frames.any { it is Snapshot } }
        val snapshot = first.last<Snapshot>()
        assertEquals(cell, snapshot.cell)
        assertEquals(listOf("Ravenscar"), snapshot.houses.map { it.name })

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
        assertEquals(1, second.last<Snapshot>().houses.size, "one player, one house")

        first.close()
        second.close()
    }
}
