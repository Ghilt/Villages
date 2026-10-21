package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import villages.application.Save
import villages.application.SaveRefused
import villages.application.WorldSaves
import villages.domain.PlayerId
import villages.protocol.ErrorFrame
import villages.protocol.SaveView
import villages.protocol.SavesListed
import villages.protocol.ServerFrame
import villages.protocol.WorldWiped
import io.kotest.matchers.collections.shouldBeEmpty
import java.time.Instant
import java.util.UUID

/** The world saved through the gateway, from the debug panel: answered with every save, or refused. See 0101. */
class GatewaySavesSpec : StringSpec({

    /** Saves held in memory, each of three events, made at noon; a name already there is refused, as on disk. */
    class Kept : WorldSaves {
        val made = mutableListOf<Save>()

        override fun save(name: String, by: PlayerId?): Save {
            if (made.any { it.name == name }) throw SaveRefused("there is a save called $name already")
            return Save(name, Instant.parse("2026-10-17T12:00:00Z"), by, 3).also { made.add(0, it) }
        }

        override fun saves(): List<Save> = made.toList()

        val loaded = mutableListOf<String>()

        override fun load(name: String): Save {
            val save = made.find { it.name == name } ?: throw SaveRefused("there is no save called $name")
            return save.also { loaded += name }
        }
    }

    fun window(rig: Rig): Pair<Gateway.Connection, MutableList<ServerFrame>> {
        val sent = mutableListOf<ServerFrame>()
        return rig.connect { sent += it }.also { it.receive(hello) } to sent
    }

    "a save is made by the player who asked, and answered to that window with every save there is" {
        val saves = Kept()
        val (connection, sent) = window(Rig(saves = saves))
        sent.clear()

        connection.receive("""{"type":"saveWorld","name":"first-test"}""")

        saves.made.single().by shouldBe PlayerId(UUID.fromString(TOKEN))
        sent shouldContainExactly listOf(
            SavesListed(listOf(SaveView("first-test", 1_792_238_400_000, TOKEN, 3, null)), saved = "first-test"),
        )
    }

    "a save refused is said as saveRefused, and closed instruments refuse to save at all" {
        val saves = Kept()
        val (connection, sent) = window(Rig(saves = saves))
        connection.receive("""{"type":"saveWorld","name":"first-test"}""")
        sent.clear()
        connection.receive("""{"type":"saveWorld","name":"first-test"}""")
        sent shouldContainExactly listOf(ErrorFrame("saveRefused", "there is a save called first-test already"))

        val closed = Kept()
        val (shut, told) = window(Rig(instrumentsOpen = false, saves = closed))
        told.clear()
        shut.receive("""{"type":"saveWorld","name":"first-test"}""")
        told.map { (it as ErrorFrame).code } shouldBe listOf("instrumentsClosed")
        closed.made shouldBe emptyList()
    }

    "the saves are listed to the window that asks, and a load ends every session, each told what the world is now" {
        val saves = Kept()
        val rig = Rig(saves = saves)
        val (connection, sent) = window(rig)
        connection.receive("""{"type":"saveWorld","name":"first-test"}""")
        val (_, theirs) = rig.someoneElse()
        sent.clear()
        theirs.clear()

        connection.receive("""{"type":"listSaves"}""")
        sent shouldContainExactly listOf(SavesListed(listOf(SaveView("first-test", 1_792_238_400_000, TOKEN, 3, null)), saved = null))
        theirs.shouldBeEmpty()

        sent.clear()
        connection.receive("""{"type":"loadSave","name":"first-test"}""")
        saves.loaded shouldBe listOf("first-test")
        val told = WorldWiped("the world is the save first-test now, 3 events")
        sent shouldContainExactly listOf(told)
        theirs shouldContainExactly listOf(told)
    }

    "a load of a save there is not is refused to the window that asked, and ends nobody's session" {
        val (connection, sent) = window(Rig(saves = Kept()))
        sent.clear()
        connection.receive("""{"type":"loadSave","name":"never-made"}""")
        sent shouldContainExactly listOf(ErrorFrame("saveRefused", "there is no save called never-made"))
    }
})
