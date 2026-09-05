package villages.domain

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.property.Arb
import io.kotest.property.arbitrary.uuid
import io.kotest.property.checkAll
import java.util.UUID

class IdsSpec : StringSpec({

    "a player's house is the same house every time it is worked out" {
        checkAll(Arb.uuid()) { id ->
            val player = PlayerId(id)

            HouseId.of(player) shouldBe HouseId.of(player)
        }
    }

    "two players have two houses" {
        checkAll(Arb.uuid(), Arb.uuid()) { one, another ->
            if (one != another) {
                HouseId.of(PlayerId(one)) shouldNotBe HouseId.of(PlayerId(another))
            }
        }
    }

    /**
     * The derivation is pinned, not merely deterministic. Changing it would leave every house already
     * founded belonging to nobody, so this vector was computed by a second implementation and any change
     * to the arithmetic has to come here and say so out loud.
     */
    "a known player has a known house, and always will" {
        val player = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))

        HouseId.of(player).value shouldBe UUID.fromString("49d14206-e7b6-3cff-b12c-0fa929182509")
    }

    "a house names its own stream" {
        val house = HouseId(UUID.fromString("6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a"))

        house.stream shouldBe "house:6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a"
    }
})
