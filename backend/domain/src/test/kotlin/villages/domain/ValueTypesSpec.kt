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

    "a location is held to the world" {
        Location(59.33, 18.07).lat shouldBe 59.33
        shouldThrow<HouseError.InvalidLocation> { Location(90.1, 0.0) }
        shouldThrow<HouseError.InvalidLocation> { Location(0.0, -180.1) }
        shouldThrow<HouseError.InvalidLocation> { Location(Double.NaN, 0.0) }
    }

    "a house id names its stream" {
        HouseId(UUID.fromString("6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a")).stream shouldBe
            "house:6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a"
    }
})
