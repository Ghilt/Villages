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

    "the same command bringing a character into the same house brings the same character" {
        checkAll(Arb.uuid(), Arb.uuid()) { house, command ->
            CharacterId.broughtIn(HouseId(house), command) shouldBe CharacterId.broughtIn(HouseId(house), command)
        }
    }

    /** A command id is public, so the same one copied into another house must not reach the first's people. */
    "the same command in another house brings another character" {
        checkAll(Arb.uuid(), Arb.uuid(), Arb.uuid()) { one, another, command ->
            if (one != another) {
                CharacterId.broughtIn(HouseId(one), command) shouldNotBe CharacterId.broughtIn(HouseId(another), command)
            }
        }
    }

    /** Pinned as the house's is, and computed by the same second implementation. */
    "a known house and command bring in a known character, and always will" {
        val house = HouseId(UUID.fromString("49d14206-e7b6-3cff-b12c-0fa929182509"))
        val command = UUID.fromString("5e0f5d1c-2a4b-4c6d-8e9f-0a1b2c3d4e5f")

        CharacterId.broughtIn(house, command).value shouldBe UUID.fromString("cb732500-39bd-3b39-a838-bb89f719578f")
    }

    "a character names their own stream" {
        val agnes = CharacterId(UUID.fromString("cb732500-39bd-3b39-a838-bb89f719578f"))

        agnes.stream shouldBe "character:cb732500-39bd-3b39-a838-bb89f719578f"
    }

    /** Pinned as the others are, by a second implementation: the castle standing in Antarctica, on every start. */
    "the castle in Antarctica is a known structure, and names its own stream" {
        val castle = StructureId.inAntarctica(StructureType("castle"))

        castle.value shouldBe UUID.fromString("95ba5c28-4a79-3fa6-88aa-0ff1f5a0a559")
        castle.stream shouldBe "structure:95ba5c28-4a79-3fa6-88aa-0ff1f5a0a559"
    }
})
