package villages.application

import villages.domain.Location

/**
 * The places a house can be offered as its first seat.
 *
 * A hand-kept list, because the server knows nothing of terrain: the world is a painted image and only the
 * browser has the tiles. Every seat here has been read out of the zoom 7 tiles of every master and is on
 * land in all of them; four candidates that were not are not here. Re-run that check whenever this list
 * or a master changes. See decision record 0034.
 *
 * The names are invented. The world is a warped Earth whose place names have not been carried through
 * yet, so a seat is named the way a chronicle would name it rather than the way an atlas would.
 */
object Gazetteer {
    /**
     * One place a house could be founded: what it is called, which part of the world it is in, where that
     * is, and a line about it for the parchment.
     *
     * The detail says nothing about terrain on purpose. The three masters disagree about what is under
     * several of these - one is taiga in one world and farmland in another - so a line claiming pines
     * would be false half the time.
     */
    data class Seat(
        val place: String,
        /** Three options come from three different regions, so an opening is never three of one thing. */
        val region: String,
        val where: Location,
        val detail: String,
    )

    val seats: List<Seat> = listOf(
        Seat(
            "Skarnholt", "the northern reaches", Location(61.0, 15.0),
            "Long winters and longer nights, and the light comes back all at once.",
        ),
        Seat(
            "Vaskarr", "the northern reaches", Location(55.0, 40.0),
            "Flat country that goes on past where anyone has bothered to look.",
        ),
        Seat(
            "Tannenmoor", "the northern reaches", Location(60.0, 95.0),
            "Cold, quiet, and a very long way from anyone who might object.",
        ),
        Seat(
            "Ulmash", "the grass sea", Location(47.0, 66.0),
            "Grass to the horizon in every direction, and riders who cross it in days.",
        ),
        Seat(
            "Khorvan", "the grass sea", Location(46.0, 104.0),
            "High, dry and open. What passes here is seen coming for half a day.",
        ),
        Seat(
            "Aldenreich", "the old heart", Location(49.7, 15.0),
            "Old roads, old rivalries, and neighbours on every side of you.",
        ),
        Seat(
            "Marovel", "the old heart", Location(40.5, -4.5),
            "High ground above a dry plain, with the sea a week away in three directions.",
        ),
        Seat(
            "Corinneth", "the sunrise lands", Location(39.0, 34.0),
            "A crossroads whether you want one or not: everything going east passes here.",
        ),
        Seat(
            "Sathvani", "the sunrise lands", Location(19.0, 77.0),
            "Broad uplands, hot for most of the year, and rich when the rains come.",
        ),
        Seat(
            "Zafarai", "the sunlands", Location(14.0, 4.0),
            "The last good ground before the sand, and the first after it.",
        ),
        Seat(
            "Umbereth", "the sunlands", Location(-1.0, 23.0),
            "Deep green country where the rivers are the roads.",
        ),
        Seat(
            "Westermark", "the far shore", Location(41.0, -100.0),
            "Open country under a very large sky, and nothing built on it yet.",
        ),
        Seat(
            "Verdance", "the far shore", Location(-5.0, -62.0),
            "Forest without end, and water enough to float a kingdom.",
        ),
        Seat(
            "Quenzal", "the far shore", Location(-24.0, -61.0),
            "Thorn country: hard to cross, harder to take, and nobody has tried.",
        ),
    )

    /** Every region the seats fall in, in the order they first appear. */
    val regions: List<String> = seats.map(Seat::region).distinct()
}
