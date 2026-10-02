package villages.gateway

import villages.application.HouseRow
import villages.domain.Banner
import villages.domain.Resource
import villages.protocol.BannerSpec
import villages.protocol.Cell
import villages.protocol.Charge
import villages.protocol.Division
import villages.protocol.HouseView
import villages.protocol.PledgeView
import villages.protocol.Point
import villages.protocol.Stock
import villages.protocol.Tincture
import villages.protocol.YourHouseView

/** A row of the read model as the map shows it. The cell on the wire is the house's deepest. */
internal fun HouseRow.toView(deepest: Cell = Cell.of(seat.lat, seat.lon)): HouseView = HouseView(
    id = id.value.toString(),
    name = name.value,
    cell = deepest.quadkey,
    seat = Point(seat.lat, seat.lon),
    banner = banner.toWire(),
    since = since.day,
    version = version,
)

/**
 * The player's own house: the public view, and what only its owner is told.
 *
 * `pledged` is summed here rather than sent as a list for the browser to add up, and the resources go on
 * this view rather than on `HouseView` so that what a house has reaches one session and not every
 * neighbour holding its cell.
 */
internal fun HouseRow.toYours(deepest: Cell = Cell.of(seat.lat, seat.lon)): YourHouseView = YourHouseView(
    house = toView(deepest),
    resources = Resource.entries.associate { resource ->
        val stock = stockOf(resource)
        resource.toWire() to Stock(
            total = stock.total,
            pledged = pledgedOf(resource),
            ratePerSecond = stock.ratePerSecond,
            asOf = stock.asOf.toEpochMilli(),
        )
    },
    pledges = pledges.map {
        PledgeView(
            id = it.id.value.toString(),
            resource = it.resource.toWire(),
            amount = it.amount,
            until = it.until.day,
            purpose = it.purpose,
        )
    },
)

/** The domain's heraldry, spelled for the interface. The two enums share their names on purpose. */
internal fun Banner.toWire(): BannerSpec = BannerSpec(
    field = Tincture.valueOf(field.name),
    division = Division.valueOf(division.name),
    second = second?.let { Tincture.valueOf(it.name) },
    charge = Charge.valueOf(charge.name),
    chargeTincture = Tincture.valueOf(chargeTincture.name),
)

/** The wire's heraldry, spelled for the interface, into the domain's. */
internal fun BannerSpec.toDomain(): Banner = Banner(
    field = field.toDomain(),
    division = when (division) {
        Division.PLAIN -> villages.domain.Division.PLAIN
        Division.PER_PALE -> villages.domain.Division.PER_PALE
        Division.PER_FESS -> villages.domain.Division.PER_FESS
        Division.QUARTERLY -> villages.domain.Division.QUARTERLY
    },
    second = second?.toDomain(),
    charge = when (charge) {
        Charge.TOWER -> villages.domain.Charge.TOWER
        Charge.STAG -> villages.domain.Charge.STAG
        Charge.STAR -> villages.domain.Charge.STAR
    },
    chargeTincture = chargeTincture.toDomain(),
)

internal fun Tincture.toDomain(): villages.domain.Tincture = villages.domain.Tincture.valueOf(name)
