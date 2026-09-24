package villages.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import java.util.UUID

class ValueTypesSpec : StringSpec({

    "a house name is trimmed and between two and thirty-two characters" {
        HouseName.of("  Ravenscar  ").value shouldBe "Ravenscar"
        shouldThrow<HouseError.InvalidName> { HouseName("R") }
        shouldThrow<HouseError.InvalidName> { HouseName("R".repeat(33)) }
        shouldThrow<HouseError.InvalidName> { HouseName(" Ravenscar") }
        HouseName("R".repeat(32)).value.length shouldBe 32
    }

    "a character's name is two parts, each trimmed and between one and thirty-two characters" {
        CharacterName("Agnes", "Hollin").family shouldBe "Hollin"
        CharacterName("A", "B".repeat(32)).given shouldBe "A"
        shouldThrow<CharacterError.InvalidName> { CharacterName("", "Hollin") }
        shouldThrow<CharacterError.InvalidName> { CharacterName("Agnes", " Hollin") }
        shouldThrow<CharacterError.InvalidName> { CharacterName("A".repeat(33), "Hollin") }
    }

    "a location is held to the world" {
        Location(59.33, 18.07).lat shouldBe 59.33
        shouldThrow<DomainError.InvalidLocation> { Location(90.1, 0.0) }
        shouldThrow<DomainError.InvalidLocation> { Location(0.0, -180.1) }
        shouldThrow<DomainError.InvalidLocation> { Location(Double.NaN, 0.0) }
    }

    "a house id names its stream" {
        HouseId(UUID.fromString("6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a")).stream shouldBe
            "house:6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a"
    }
})
