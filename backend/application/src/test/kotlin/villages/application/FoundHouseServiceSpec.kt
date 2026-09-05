package villages.application

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import villages.domain.Banner
import villages.domain.Charge
import villages.domain.Division
import villages.domain.FoundHouse
import villages.domain.HouseCommand
import villages.domain.HouseDecider
import villages.domain.HouseError
import villages.domain.HouseEvent
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.Tincture
import villages.domain.WorldTime
import java.time.Instant
import java.util.UUID

/** An executor that keeps one stream in a list, so the use case can be tested without a store. */
private class RememberingExecutor : HouseCommandExecutor {
    val events = mutableListOf<HouseEvent>()

    override fun execute(command: HouseCommand) {
        events += HouseDecider.decide(command, HouseDecider.fold(events))
    }
}

class FoundHouseServiceSpec : StringSpec({
    val noon = Instant.parse("2026-09-04T12:00:00Z")
    val executor = RememberingExecutor()
    val service = FoundHouseService(executor, clock = { noon }, world = { WorldTime(454901) })
    val house = HouseId(UUID.fromString("6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a"))
    val player = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    val banner = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT)

    "stamps the server's instant on the command and runs it" {
        service.found(house, player, HouseName("Ravenscar"), Location(59.33, 18.07), banner)

        val founded = executor.events.single().shouldBeInstanceOf<villages.domain.HouseFounded>()
        founded.recordedAt shouldBe noon
        founded.worldTime shouldBe WorldTime(454901)
        founded.treasury.asOf shouldBe noon
    }

    "lets the decider's refusal through untouched" {
        shouldThrow<HouseError.AlreadyFounded> {
            service.found(house, player, HouseName("Ravenscar"), Location(59.33, 18.07), banner)
        }
    }

    "an anonymous token is the player's id as text" {
        AnonymousTokens.playerOf("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d") shouldBe player
        shouldThrow<IllegalArgumentException> { AnonymousTokens.playerOf("not-a-uuid") }
    }
})
