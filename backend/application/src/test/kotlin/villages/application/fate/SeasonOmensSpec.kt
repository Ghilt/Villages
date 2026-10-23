package villages.application.fate

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.application.HouseRow
import villages.domain.Banner
import villages.domain.Charge
import villages.domain.Division
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.Significance
import villages.domain.Tincture
import villages.domain.WorldTime
import villages.domain.foundingStocks
import java.time.Instant
import java.util.UUID

/** The time of year where the seat is: the northern months, turned round south of the equator. */
class SeasonOmensSpec : StringSpec({
    val player = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    fun seatedAt(lat: Double) = Moment(
        HouseRow(
            HouseId.of(player), player, HouseName("Ravenscar"), Location(lat, 18.0), Significance(20.0),
            Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT),
            resources = foundingStocks(Instant.EPOCH), pledges = emptyList(), since = WorldTime(1), until = null, version = 1,
        ),
        Looking.NOTHING,
        WorldTime(1),
        Instant.EPOCH,
        25.0,
    )

    fun seasonIn(month: Int, lat: Double) = SeasonOmens { month }.read(seatedAt(lat)).single().words

    "the northern months make the seasons in the north" {
        (1..12).map { seasonIn(it, 59.0) } shouldBe listOf(
            "Winter", "Winter", "Spring", "Spring", "Spring", "Summer",
            "Summer", "Summer", "Autumn", "Autumn", "Autumn", "Winter",
        )
    }

    "south of the equator the year is turned round" {
        listOf(1, 4, 7, 10).map { seasonIn(it, -33.0) } shouldBe listOf("Summer", "Autumn", "Winter", "Spring")
    }
})
