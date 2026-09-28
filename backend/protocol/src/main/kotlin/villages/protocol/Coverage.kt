package villages.protocol

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.atan2
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.sqrt

/**
 * What a set of vision points covers, with **surface tension**: every one of their circles, and every gap or
 * notch between them that a ball as big as the tension cannot get into. So two circles close together are
 * seen across, a notch where two overlap is rounded off, and a lone circle stays exactly its circle however
 * tense - the ball only fills what it cannot reach, and it can reach all the way round a circle on its own.
 * A place seen again and again adds nothing, which matters for revealed ground, where the points pile up.
 * Adam's picture, and decision record 0064.
 *
 * Whether a place is covered is answered exactly. A place inside a circle is; otherwise it is covered when
 * every ball of the tension's size containing it would stray into a circle - that is, when the disc of every
 * centre such a ball could have is covered by the circles grown by the tension. A disc is covered by a set of
 * discs when its rim is, and when no two of them cross inside it at a point that no third covers, because a
 * hole among discs always has such a corner. The circles are the map's circles at their own latitudes, as in
 * `Reach`, grown by the tension at theirs; the ball is as big as the tension at the place's latitude.
 *
 * Both ends compute it identically, and `contracts/fixtures/coverage.json` holds them to the same answers:
 * the gateway holds back by it, and the page draws the fog clear inside it.
 */
class Coverage(circles: List<Circle>, private val tension: Double) {

    /** A vision point's circle: where it is, and how far it sees, in kilometres. */
    data class Circle(val lat: Double, val lon: Double, val kilometres: Double)

    private class Disc(val x: Double, val y: Double, val r: Double)

    private val plain = circles.map { Disc(mercatorX(it.lon), mercatorY(it.lat), across(it.lat, it.kilometres)) }

    /**
     * The circles grown by the tension, less any lying wholly inside another: it could change no answer, and
     * revealed ground is mostly circles inside circles. Of two the same, the first stands.
     */
    private val grown: List<Disc> = circles
        .map { Disc(mercatorX(it.lon), mercatorY(it.lat), across(it.lat, it.kilometres + tension)) }
        .let { all ->
            all.filterIndexed { i, disc ->
                all.indices.none { j -> j != i && holds(all[j], disc) && (!holds(disc, all[j]) || j < i) }
            }
        }

    private fun holds(outer: Disc, inner: Disc): Boolean =
        hypot(outer.x - inner.x, outer.y - inner.y) + inner.r <= outer.r

    fun covers(lat: Double, lon: Double): Boolean = coveredWithin(mercatorX(lon), mercatorY(lat), across(lat, tension), 0.0)

    /**
     * Whether anything covered lies within `distance` of the point `x`, `y` of the Mercator square, all three
     * as shares of its side: whether a disc that big about the point touches what is covered. Only the gateway
     * asks it, of a stand of the scenery.
     *
     * Answered by growing every circle by the distance, and the grown circles' coverage holds every point that
     * close to the true one: a ball fitting in no gap among the true circles fits in none among the grown. So it
     * can answer yes a little wide of the edge, where the tension bridges a gap, and never answers no to a disc
     * that does touch. At no distance it is `covers`.
     */
    fun reaches(x: Double, y: Double, distance: Double): Boolean =
        coveredWithin(x, y, across(latitudeAt(y), tension), distance)

    /** Whether the point, with every circle grown by `growth`, is covered, with a ball of `ball` for the tension. */
    private fun coveredWithin(x: Double, y: Double, ball: Double, growth: Double): Boolean {
        if (plain.any { hypot(it.x - x, it.y - y) <= it.r + growth }) {
            return true
        }
        if (tension <= 0.0) {
            return false
        }
        // Grown alike, a circle lying wholly inside another still does, so the ones left out stay left out.
        val near = grown
            .filter { hypot(it.x - x, it.y - y) < it.r + growth + ball }
            .map { if (growth == 0.0) it else Disc(it.x, it.y, it.r + growth) }
        if (near.isEmpty()) {
            return false
        }
        if (near.any { hypot(it.x - x, it.y - y) + ball <= it.r }) {
            return true
        }
        return rimCovered(near, x, y, ball) && noUncoveredCorner(near, x, y, ball)
    }

    /** Whether the rim of the disc of radius `ball` about the place lies wholly inside the discs near it. */
    private fun rimCovered(near: List<Disc>, x: Double, y: Double, ball: Double): Boolean {
        val arcs = mutableListOf<DoubleArray>()
        for (disc in near) {
            val dx = disc.x - x
            val dy = disc.y - y
            val apart = hypot(dx, dy)
            val cosine = (apart * apart + ball * ball - disc.r * disc.r) / (2.0 * apart * ball)
            if (cosine >= 1.0) {
                continue
            }
            val middle = atan2(dy, dx)
            val half = acos(max(-1.0, cosine))
            var from = (middle - half) % TURN
            if (from < 0.0) {
                from += TURN
            }
            val to = from + 2.0 * half
            if (to > TURN) {
                arcs += doubleArrayOf(from, TURN)
                arcs += doubleArrayOf(0.0, to - TURN)
            } else {
                arcs += doubleArrayOf(from, to)
            }
        }
        arcs.sortBy { it[0] }
        var reached = 0.0
        for (arc in arcs) {
            if (arc[0] > reached) {
                return false
            }
            reached = max(reached, arc[1])
        }
        return reached >= TURN
    }

    /** Whether every point inside the disc where two discs cross is inside a third, so that no hole has a corner. */
    private fun noUncoveredCorner(near: List<Disc>, x: Double, y: Double, ball: Double): Boolean {
        for (i in near.indices) {
            for (j in i + 1 until near.size) {
                val a = near[i]
                val b = near[j]
                val dx = b.x - a.x
                val dy = b.y - a.y
                val apart = hypot(dx, dy)
                if (apart >= a.r + b.r || apart <= abs(a.r - b.r)) {
                    continue
                }
                val along = (apart * apart + a.r * a.r - b.r * b.r) / (2.0 * apart)
                val off = sqrt(max(0.0, a.r * a.r - along * along))
                val midX = a.x + along * dx / apart
                val midY = a.y + along * dy / apart
                for (side in SIDES) {
                    val cornerX = midX - side * off * dy / apart
                    val cornerY = midY + side * off * dx / apart
                    if (hypot(cornerX - x, cornerY - y) >= ball) {
                        continue
                    }
                    val coveredByAThird = near.indices.any { k ->
                        k != i && k != j && hypot(cornerX - near[k].x, cornerY - near[k].y) < near[k].r
                    }
                    if (!coveredByAThird) {
                        return false
                    }
                }
            }
        }
        return true
    }

    private companion object {
        const val TURN = 2.0 * PI
        val SIDES = doubleArrayOf(-1.0, 1.0)
    }
}
