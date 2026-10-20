package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import villages.protocol.ChallengeSimulated
import villages.protocol.ServerFrame
import villages.protocol.SimulationRefused

/**
 * The challenge through the gateway: the simulator's page, which says no hello, has the engine fight a challenge out
 * and is sent every moment of it, or a refusal saying why. An instrument, refused while they are closed. See 0105.
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

    "a server with its instruments closed refuses it" {
        val (page, sent) = Rig(instrumentsOpen = false).page()

        page.receive(simulating("violence", "violence.sellswords"))

        (sent.single() as SimulationRefused).code shouldBe "instrumentsClosed"
    }
})
