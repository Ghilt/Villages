package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import villages.protocol.ChallengeSimulated
import villages.protocol.MatchupsSimulated
import villages.protocol.ServerFrame
import villages.protocol.SimulationRefused

/**
 * The challenge through the gateway: the simulator's page, which says no hello, has the engine fight a challenge out
 * and is sent every moment of it, or a refusal saying why. An instrument, refused while they are closed. See 0107.
 */
class GatewayChallengesSpec : StringSpec({

    fun Rig.page(): Pair<Gateway.Connection, MutableList<ServerFrame>> {
        val sent = mutableListOf<ServerFrame>()
        return gateway.connect { sent += it } to sent
    }

    fun simulating(aspect: String, effect: String, seed: String = "") =
        """{"type":"simulateChallenge","id":"run-1","a":[{"aspect":"$aspect","power":50,"integrity":50,"summonCount":1,""" +
            """"effects":["$effect"],"slotted":{}}],"b":[{"aspect":"diplomacy","power":50,"integrity":50,"summonCount":1,""" +
            """"effects":["diplomacy.envoy"],"slotted":{}}],"progression":{"seconds":5,"happenings":[["reason"]]}$seed}"""

    "a page is sent every moment of the challenge it asked for, and what it came to, from the seed it gave" {
        val (page, sent) = Rig().page()

        page.receive(simulating("violence", "violence.sellswords", ""","seed":42"""))

        val fought = sent.single() as ChallengeSimulated
        fought.id shouldBe "run-1"
        fought.seed shouldBe 42L
        fought.catalogue shouldBe "rig-fingerprint"
        fought.outcome.tug shouldBe 40.0
        fought.outcome.ended shouldBe "timeRanOut"
        fought.outcome.wonBy shouldBe "a"
        fought.moments.first().what shouldBe "happeningBegan"
        fought.moments.filter { it.what == "pulled" }.map { it.actor } shouldBe List(4) { "#1" }
        fought.summons.single().kind shouldBe "mercenary"
    }

    "with no seed given, the server draws one, and says which" {
        val (page, sent) = Rig().page()

        page.receive(simulating("violence", "violence.sellswords"))

        (sent.single() as ChallengeSimulated).seed shouldBe 7L
    }

    "a setup that cannot be fought, or names an aspect there is not, is refused saying why" {
        val (page, sent) = Rig().page()

        page.receive(simulating("violence", "diplomacy.envoy"))
        page.receive(simulating("valour", "violence.sellswords"))

        val (wrongAspect, noAspect) = sent.map { it as SimulationRefused }
        wrongAspect.code shouldBe "invalidSetup"
        wrongAspect.reason shouldContain "a1 is violence and carries diplomacy.envoy, of another aspect"
        noAspect.reason shouldBe "not an aspect: valour"
    }

    "a progression is drawn from the challenge kind a page names, and sent with what it came to" {
        val (page, sent) = Rig().page()

        page.receive(simulating("violence", "violence.sellswords").replace(""""progression":{"seconds":5,"happenings":[["reason"]]}""", """"kind":"skirmish""""))

        val fought = sent.single() as ChallengeSimulated
        fought.progression.seconds shouldBe 5
        fought.progression.happenings shouldBe listOf(listOf("reason"))
        fought.outcome.tug shouldBe 40.0
    }

    "a batch is answered with its sums, and the moments of its first run" {
        val (page, sent) = Rig().page()

        page.receive(simulating("violence", "violence.sellswords", ""","seed":42,"runs":20"""))

        val fought = sent.single() as ChallengeSimulated
        fought.batch!!.runs shouldBe 20
        fought.batch!!.wonByA shouldBe 20
        fought.batch!!.spread.size shouldBe 5
        fought.batch!!.spread.all { it.sum() == 20 } shouldBe true
        fought.batch!!.ends.sum() shouldBe 20
        fought.seed shouldBe 42L
        fought.moments.isNotEmpty() shouldBe true
    }

    "every aspect is weighed against every other, and sent as a grid" {
        val (page, sent) = Rig().page()

        page.receive("""{"type":"simulateMatchups","id":"grid-1","kind":"skirmish","runs":4,"seed":3}""")

        val grid = sent.single() as MatchupsSimulated
        grid.aspects.size shouldBe 10
        grid.cells.size shouldBe 10
        grid.cells.all { row -> row.size == 10 && row.all { it.wonByA + it.wonByB + it.even == 4 } } shouldBe true
        grid.seed shouldBe 3L
    }

    "a server with its instruments closed refuses it" {
        val (page, sent) = Rig(instrumentsOpen = false).page()

        page.receive(simulating("violence", "violence.sellswords"))

        (sent.single() as SimulationRefused).code shouldBe "instrumentsClosed"
    }
})
