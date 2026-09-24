package villages.domain

/**
 * What a character is called: a given name and a family name, each trimmed and between one and thirty-two
 * characters. Two parts rather than one line, because who is kin to whom is a question a later mechanic
 * will ask, and a line would have to be split to answer it.
 */
data class CharacterName(val given: String, val family: String) {
    init {
        refuseUnlessGood(given, "given")
        refuseUnlessGood(family, "family")
    }

    private fun refuseUnlessGood(part: String, which: String) {
        if (part != part.trim()) throw CharacterError.InvalidName("the $which name has space at either end")
        if (part.isEmpty()) throw CharacterError.InvalidName("the $which name is empty")
        if (part.length > LONGEST) throw CharacterError.InvalidName("the $which name is longer than $LONGEST characters")
    }

    companion object {
        const val LONGEST = 32
    }
}

/** Whether a character is a woman or a man, which the names and the portraits they are given follow. */
enum class Sex { WOMAN, MAN }

/**
 * What kind of being a character is: a person, and only a person so far. A pet would be a character of
 * another species rather than a different sort of thing. Not called a kind, because a kind is a sort of
 * scenery.
 */
enum class Species { PERSON }

/**
 * One of a character's four qualities, each a whole number between one and twenty. A key figure's power is
 * their stats. Piety and reason are the house's resources' words on purpose, and are meant to be joined to
 * them one day; they are not the same type, because a stat is a person's and a resource is a house's. See
 * decision record 0055.
 */
enum class Stat { PIETY, REASON, KINDNESS, PHYSICAL }

/**
 * A character, folded from their stream. Every stream starts as [NotAppeared]; a character who has appeared
 * stays [Appeared] for good, dead or alive, because a death is part of a history and not the end of one.
 */
sealed interface Character {
    data object NotAppeared : Character

    data class Appeared(
        val id: CharacterId,
        val name: CharacterName,
        val sex: Sex,
        val species: Species,
        /** The day they were born, which can be long before the day they appeared. Their age counts from it. */
        val bornOn: WorldTime,
        val stats: Map<Stat, Int>,
        /** A portrait's key, kept for life, or none. */
        val portrait: String?,
        val appearedOn: WorldTime,
        /**
         * Years they were aged out of the ordinary, which an age adds to the years since the birthday. The
         * domain has no calendar, so the age itself is worked out wherever there is one. See decision 0055.
         */
        val agedYears: Int = 0,
        /**
         * Where they stand in the world, or null while they are on no map. A character is nowhere until
         * something moves them, and a death leaves this where it was: it is where they died.
         */
        val place: Location? = null,
        /** How much they matter to the world where they stand, which decides how far out they are drawn. */
        val significance: Significance? = null,
        val death: Death? = null,
    ) : Character
}

/** When a character died, and why, in words until the world has causes of its own. */
data class Death(val on: WorldTime, val cause: String)
