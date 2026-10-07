package villages.gateway

import villages.application.CharacterRow
import villages.application.CharacterSpan
import villages.application.HouseRow
import villages.application.PlacedCharacter
import villages.application.VisionPoint
import villages.domain.HouseId
import villages.domain.PlayerId
import villages.domain.Vision
import villages.domain.WorldTime
import villages.protocol.Coverage
import villages.protocol.StandRecords
import kotlin.math.cos
import kotlin.math.hypot

/**
 * What the fog of war lets one player be sent, worked out from their house's vision points: the table in
 * decision record 0061, asked of everything before it goes to them.
 *
 * - **Vision**, the points lasting on the day looked at: everything.
 * - **Revealed**, every point there has been: what stands still, which is the buildings, and not what moves,
 *   which is people.
 * - **Unknown**: only what is of significance 80 or more.
 *
 * A player's own house and own key figures always reach them. Every one of them gives vision where it stands,
 * so this changes nothing about what is sent; said outright, it means a key figure's move is never told as a
 * departure while the sight that follows them is still catching up.
 *
 * Whether a place is revealed or in vision is `Coverage`: the points' circles with the surface tension between
 * them (0064), the arithmetic the page draws the fog with, so what is sent and what is drawn clear cannot
 * disagree. Revealed ground is worked out once, from every point; vision is worked out for the day asked
 * about, and kept for the next question about the same day, which is nearly every question.
 */
internal class Fog(
    private val player: PlayerId?,
    private val points: List<VisionPoint>,
    private val tension: Double = Vision.SURFACE_TENSION,
) {
    private val house: HouseId? = player?.let { HouseId.of(it) }
    private val revealed = coverageOf(points)

    /** The vision of the last day asked about. Two threads asking at once can only work it out twice. */
    @Volatile
    private var vision: Pair<WorldTime, Coverage>? = null

    fun letsThrough(row: HouseRow): Boolean =
        row.player == player ||
            row.significance.value >= SEEN_THROUGH_THE_FOG ||
            revealed.covers(row.seat.lat, row.seat.lon)

    fun letsThrough(row: CharacterRow, span: CharacterSpan, on: WorldTime): Boolean =
        row.keyFigureOf.any { it.house == house } ||
            span.significance.value >= SEEN_THROUGH_THE_FOG ||
            visionOn(on).covers(span.place.lat, span.place.lon)

    /**
     * Whether a stand of the scenery shapes what grows on ground this house has revealed: whether revealed ground
     * lies within its reach of its middle, and the scatter's margin past that. The middle and the reach are in
     * world units. A stand stands still, so revealed is enough, as it is for a house; and a house with no points
     * reveals nothing, so it is sent no stands at all.
     */
    fun letsThrough(x: Double, y: Double, reach: Double): Boolean =
        revealed.reaches(x / WORLD, y / WORLD, (reach + STAND_MARGIN) / WORLD)

    /**
     * Where somebody was last seen by this house, and the day the fog hid them: the latest of their spans in which
     * its vision covered where they stood, and the day that stopped - null while it still does on [today]. Null
     * when it never saw them. See [hiding] and decision record 0089.
     */
    fun lastSeen(stood: List<PlacedCharacter>, today: WorldTime): Pair<PlacedCharacter, WorldTime?>? =
        if (stood.isEmpty()) {
            null
        } else {
            hiding(points, stood.flatMap { listOf(it.span.since, it.span.until) }, today) { day, partly ->
                seenOn(stood, day, partly)
            }
        }

    /**
     * The day the fog hid a house from this one, for a house it is sent: null while it sees it on [today] - its own,
     * one seen from anywhere, one its vision covers - and otherwise the end of the last stretch in which its vision
     * covered the seat. Ground the surface tension revealed between points that never saw on one day was never in
     * one day's vision, so a house there was hidden on the day it was revealed. A house never moves, so only the
     * points near its seat are asked about, which keeps this cheap enough to ask of every house a cell sends.
     */
    fun hidOn(row: HouseRow, today: WorldTime): WorldTime? {
        if (row.player == player || row.significance.value >= SEEN_THROUGH_THE_FOG) return null
        val (lat, lon) = row.seat.lat to row.seat.lon
        val near = points.filter { point ->
            val north = (point.place.lat - lat) * KILOMETRES_A_DEGREE
            val east = (point.place.lon - lon) * KILOMETRES_A_DEGREE * cos(Math.toRadians((point.place.lat + lat) / 2))
            hypot(north, east) < (point.radius + 2 * tension) * NEAR_ENOUGH
        }
        val sees = { these: List<VisionPoint> -> coverageOf(these).covers(lat, lon) }
        hiding(near, emptyList(), today) { day, partly -> Unit.takeIf { sees(near.filter { it.during(day, partly) }) } }
            ?.let { return it.second }
        return near.map { it.since }.distinct().sorted().firstOrNull { day -> sees(near.filter { it.since <= day }) }
    }

    /**
     * What [seenOn] finds on [today], with no day, or else on the latest day before it that it finds anything, with
     * the day the fog hid it. Vision and where somebody stands change only on the days a point or a span begins or
     * ends - [asked]'s, and [also] - so those days and the ones before them are all there is to ask about. A point
     * or a span begun and ended on one day was there for part of it, and counts - [seenOn]'s `partly` - on that day.
     */
    private inline fun <T : Any> hiding(
        asked: List<VisionPoint>,
        also: List<WorldTime?>,
        today: WorldTime,
        seenOn: (day: WorldTime, partly: Boolean) -> T?,
    ): Pair<T, WorldTime?>? {
        seenOn(today, false)?.let { return it to null }
        val days = (asked.flatMap { listOf(it.since, it.until) } + also)
            .filterNotNull()
            .flatMap { listOf(it, WorldTime(it.day - 1)) }
            .filter { it <= today }
            .distinct()
            .sortedDescending()
        for (day in days) {
            if (day < today) seenOn(day, false)?.let { return it to WorldTime(day.day + 1) }
            seenOn(day, true)?.let { return it to day }
        }
        return null
    }

    /** Whom of [stood] this house saw on [day]: through the whole of it, or - [partly] - for some of it as well. */
    private fun seenOn(stood: List<PlacedCharacter>, day: WorldTime, partly: Boolean): PlacedCharacter? {
        val there = stood.firstOrNull { during(it.span.since, it.span.until, day, partly) } ?: return null
        if (there.row.keyFigureOf.any { it.house == house } || there.span.significance.value >= SEEN_THROUGH_THE_FOG) {
            return there
        }
        val vision = coverageOf(points.filter { it.during(day, partly) })
        return there.takeIf { vision.covers(it.span.place.lat, it.span.place.lon) }
    }

    private fun VisionPoint.during(day: WorldTime, partly: Boolean): Boolean = during(since, until, day, partly)

    /** Whether a stretch from [since] until [until] is on [day]: the whole of it, or - [partly] - some of it. */
    private fun during(since: WorldTime, until: WorldTime?, day: WorldTime, partly: Boolean): Boolean =
        since <= day && (until == null || day < until || (partly && since == until))

    private fun visionOn(on: WorldTime): Coverage {
        vision?.takeIf { it.first == on }?.let { return it.second }
        return coverageOf(points.filter { it.covers(on) }).also { vision = on to it }
    }

    private fun coverageOf(these: List<VisionPoint>): Coverage =
        Coverage(these.map { Coverage.Circle(it.place.lat, it.place.lon, it.radius) }, tension)

    companion object {
        /** How significant a thing has to be to be seen from anywhere: 0061's really big event, drawn from zoom 2. */
        const val SEEN_THROUGH_THE_FOG = 80.0

        /** The fog of a connection that has not said who it is: it sees nothing, so only the really big. */
        val NOBODY = Fog(null, emptyList())

        /**
         * How far past its own reach a stand is still worth sending, in world units. The page thins what a stand
         * scatters by spacing it from its neighbours, a few units across, and reads revealed ground off a field a
         * unit or so to the texel: a stand this close to revealed ground can change what grows on it, so it goes.
         */
        const val STAND_MARGIN = 8.0

        private const val WORLD = StandRecords.WORLD_UNITS.toDouble()

        /** A degree of latitude, near enough, for telling which vision points are anywhere near a house. */
        private const val KILOMETRES_A_DEGREE = 111.2

        /**
         * How much further than its reach and the tension's twice over a point is still asked about a house: the
         * coverage reads the map's stretched circles at their own latitudes, and this leaves room for that.
         */
        private const val NEAR_ENOUGH = 1.5
    }
}
