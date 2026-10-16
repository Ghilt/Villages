package villages.application.fate

import villages.application.Balance
import villages.application.Gazetteer
import villages.domain.Location
import villages.domain.Omen
import villages.domain.OmenKind
import villages.domain.Resource
import kotlin.math.cos

/**
 * How the house stands, as omens: where its holdings are, whether it is still a weak house, and whether it is pious.
 * Read off the map's read model of the house, so it says what the treasury says. The thresholds are the balance's.
 */
class HouseOmens(private val balance: () -> Balance) : OmenSource {
    override fun read(moment: Moment): List<Omen> = listOfNotNull(
        regionOf(moment.house.seat).let { Omen(OmenKeys.holdings(it), OmenKind.HOUSE, "Holdings in $it") },
        Omen(OmenKeys.WEAK, OmenKind.HOUSE, "Weak house")
            .takeIf { moment.today.day - moment.house.since.day < balance().omens.weakForDays },
        moment.house.stockOf(Resource.PIETY).at(moment.now).let { piety ->
            Omen(OmenKeys.PIOUS, OmenKind.HOUSE, "Pious", piety).takeIf { piety >= balance().omens.piousAt }
        },
    )

    companion object {
        /** The region of the gazetteer's seat nearest a place: the part of the world a house's holdings are in. */
        fun regionOf(place: Location): String =
            Gazetteer.seats.minBy { seat -> roughDistance(seat.where, place) }.region

        private fun roughDistance(a: Location, b: Location): Double {
            val across = (a.lon - b.lon) * cos(Math.toRadians((a.lat + b.lat) / 2))
            val down = a.lat - b.lat
            return across * across + down * down
        }
    }
}
