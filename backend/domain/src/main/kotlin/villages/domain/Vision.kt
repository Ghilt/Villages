package villages.domain

/**
 * How far a house sees, from anything it sees from.
 *
 * A distance on the ground, in kilometres, because how far a house sees is a fact about the world; how big
 * that is on a map is the map's to work out. See decision record 0061.
 */
object Vision {
    /**
     * A circle as big as Mallorca, about 3,640 square kilometres: Adam's size for everything that gives vision
     * for now - a seat, a key figure standing on the map, and a vision given outright, which carries it on its
     * event so that changing this later does not change what was given.
     */
    const val MALLORCA = 34.0

    /**
     * How tense the edge of sight is, in kilometres: the size of the ball that cannot get into whatever gap or
     * notch it fills. Two circles closer than this is wide are seen across, a notch where two overlap is
     * rounded off by a curve this big, and a lone circle is left exactly as it is. Adam's picture; the number
     * is a matter of taste, and bridges gaps of up to about 56 km between two seat-sized circles. See
     * decision record 0064.
     */
    const val SURFACE_TENSION = 40.0
}
