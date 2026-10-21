package villages.domain.challenge

/**
 * One row of what happened in a challenge: the [second], the [happening], who did [what] to whom, how much, whether
 * it was boosted, and the tug after it. A moment changes the tug once at most, so the changes of a challenge's
 * moments add up to where its tug ends; the moments are its spectacle. See decision record 0107.
 */
data class ChallengeMoment(
    val second: Int,
    val happening: Int,
    val side: Side?,
    val actor: Actor,
    val what: What,
    val effect: String? = null,
    val target: Actor? = null,
    val amount: Double? = null,
    val boosted: Boolean = false,
    val tugDelta: Double = 0.0,
    val tugAfter: Double,
    /** The effect the deed was done to: a trigger cancelled. */
    val targetEffect: String? = null,
)

/** Who did a moment's deed: a slice by its side and place, a summon by its serial, or the challenge itself. */
sealed interface Actor {
    /** Side A's first slice is `a1`. */
    data class OfSlice(val side: Side, val index: Int) : Actor {
        override fun toString(): String = "${side.name.lowercase()}${index + 1}"
    }

    /**
     * A summon by its [serial], which it keeps when it turns, and its [kind]: a summon's id in the catalogue, or
     * [ON_THE_LINE] for a building or a person put on the line, [called] by the stand-in's name.
     */
    data class OfSummon(val serial: Int, val kind: String, val called: String? = null) : Actor {
        override fun toString(): String = "#$serial"
    }

    data object TheChallenge : Actor

    companion object {
        const val ON_THE_LINE = "onTheLine"
    }
}

/** What a moment says happened. */
enum class What {
    /** A happening began; its aspects are the progression's. */
    HAPPENING_BEGAN,

    /** A slice's aspect matches the happening that began; [ChallengeMoment.effect] names what held it matching, when something did. */
    MATCHES,

    /** A summon whose kind needs a matching aspect sat out the seconds of a happening that does not have its own. */
    IDLE,
    SUMMONED,

    /** A summon could not come: its side has as many as its slices let it have. */
    NO_ROOM,

    /** A slot with nothing in it was asked for what is in it. */
    EMPTY_SLOT,
    PULLED,

    /** A summon cost its own side. */
    COST,

    /** A key figure lent a stat. */
    LENT,

    /** A building or a person came on the line, paying as it arrived. */
    ARRIVED,
    KILLED,
    TURNED,

    /** A summon that would have turned found no room on its new side, and left both. */
    DESERTED,
    SILENCED,

    /** An act was stopped before it was made. */
    STOPPED,

    /** A trigger was cancelled before it fired. */
    CANCELLED,
    INTEGRITY_LOST,
    AURA_ON,
    AURA_OFF,

    /** A coffer was filled. */
    BANKED,

    /** A coffer poured into the tug. */
    POURED,
    COFFER_LOST,

    ENDED,
}
