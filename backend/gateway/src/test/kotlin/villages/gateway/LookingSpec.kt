package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.domain.WorldTime

/**
 * The way a connection looks, as one value. What it lets through is held by the fog, timeline and sight specs,
 * through the gateway; this holds what only it answers.
 */
class LookingSpec : StringSpec({
    val someDay = WorldTime(1000)

    "live looks at today, and a day gone back to is the day it looks at" {
        Looking().isLive shouldBe true
        Looking().day { someDay } shouldBe someDay
        Looking(at = WorldTime(5)).isLive shouldBe false
        Looking(at = WorldTime(5)).day { someDay } shouldBe WorldTime(5)
    }

    "what the fog lets through changes with the switch, and with the fog under it only while it is on" {
        val fogged = Looking()
        val otherFog = Fog(null, emptyList())

        fogged.copy(fogged = false).fogsOtherwiseThan(fogged) shouldBe true
        fogged.copy(fog = otherFog).fogsOtherwiseThan(fogged) shouldBe true
        Looking(fogged = false).copy(fog = otherFog).fogsOtherwiseThan(Looking(fogged = false)) shouldBe false
        fogged.copy(everything = true, at = someDay).fogsOtherwiseThan(fogged) shouldBe false
    }
})
