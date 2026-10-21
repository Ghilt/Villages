package villages.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import java.time.Instant

class WorldDeciderSpec : StringSpec({

    val noon = Instant.parse("2026-10-16T12:00:00Z")
    val first = "a".repeat(64)
    val second = "b".repeat(64)

    /** Says where two texts differ as the server would, by naming both, so a test can see what it was given. */
    val decider = WorldDecider { before, after -> listOf("$before->$after") }

    fun takeOn(fingerprint: String, text: String, catalogue: String = "structures") =
        TakeOnCatalogue(catalogue, text, fingerprint, WorldTime(653_712), noon)

    "the first version of a catalogue is recorded whole, with nothing before it" {
        decider.decide(takeOn(first, "{one}"), decider.initial) shouldBe listOf(
            WorldCatalogueChanged("structures", first, null, emptyList(), "{one}", WorldTime(653_712), noon),
        )
    }

    "the version last recorded is taken on again without a word" {
        val record = decider.fold(decider.decide(takeOn(first, "{one}"), decider.initial))

        decider.decide(takeOn(first, "{one}"), record).shouldBeEmpty()
    }

    "a new version names the one it replaced and where they differ" {
        val record = decider.fold(decider.decide(takeOn(first, "{one}"), decider.initial))

        decider.decide(takeOn(second, "{two}"), record) shouldBe listOf(
            WorldCatalogueChanged("structures", second, first, listOf("{one}->{two}"), "{two}", WorldTime(653_712), noon),
        )
    }

    "each catalogue is its own, folders and all" {
        val record = decider.fold(decider.decide(takeOn(first, "{one}"), decider.initial))

        (decider.decide(takeOn(first, "{one}", catalogue = "dialogues/letter"), record).single() as WorldCatalogueChanged).previous shouldBe null
    }

    "a name off the shelf or a fingerprint that is not one is refused" {
        shouldThrow<WorldError.InvalidCatalogue> { decider.decide(takeOn(first, "{}", catalogue = "../world"), decider.initial) }
        shouldThrow<WorldError.InvalidCatalogue> { decider.decide(takeOn(first, "{}", catalogue = "Structures"), decider.initial) }
        shouldThrow<WorldError.InvalidCatalogue> { decider.decide(takeOn("abc", "{}"), decider.initial) }
    }

    val london = Bot(PlayerId.botAt("Q84"), "Q84")
    val paris = Bot(PlayerId.botAt("Q90"), "Q90")
    fun create(vararg bots: Bot) = CreateBots(bots.toList(), WorldTime(653_712), noon)

    "each house bot the world lacks is made, once, and one named twice in the asking is made once" {
        decider.decide(create(london, paris, london), decider.initial) shouldBe listOf(
            WorldBotCreated(london.player, "Q84", WorldTime(653_712), noon),
            WorldBotCreated(paris.player, "Q90", WorldTime(653_712), noon),
        )
    }

    "a bot already made writes nothing, so an opening asking for the same bots again is silent" {
        val record = decider.fold(decider.decide(create(london), decider.initial))

        record.bots shouldBe mapOf(london.player to "Q84")
        decider.decide(create(london), record).shouldBeEmpty()
        decider.decide(create(london, paris), record).map { (it as WorldBotCreated).town } shouldBe listOf("Q90")
    }

    "the world remembers its catalogues and its bots side by side" {
        val record = decider.fold(decider.decide(takeOn(first, "{one}"), decider.initial) + decider.decide(create(london), decider.initial))

        record.catalogues.keys shouldBe setOf("structures")
        record.bots.keys shouldBe setOf(london.player)
    }

    "a bot whose player is not the one its town names, or with no town, is refused" {
        shouldThrow<WorldError.InvalidBot> { decider.decide(create(Bot(PlayerId.botAt("Q90"), "Q84")), decider.initial) }
        shouldThrow<WorldError.InvalidBot> { decider.decide(create(Bot(PlayerId.botAt(""), "")), decider.initial) }
    }

    "a bot's player is the same on every tree, and every town's is its own" {
        PlayerId.botAt("Q84") shouldBe PlayerId.botAt("Q84")
        (PlayerId.botAt("Q84") == PlayerId.botAt("Q90")) shouldBe false
    }
})
