package villages.domain

/** What a house is called: trimmed, and between two and thirty-two characters. */
@JvmInline
value class HouseName(val value: String) {
    init {
        if (value != value.trim()) throw HouseError.InvalidName("has space at either end")
        if (value.length < SHORTEST) throw HouseError.InvalidName("shorter than $SHORTEST characters")
        if (value.length > LONGEST) throw HouseError.InvalidName("longer than $LONGEST characters")
    }

    companion object {
        const val SHORTEST = 2
        const val LONGEST = 32

        /** Trims for the caller, then checks. What an interface should call. */
        fun of(raw: String): HouseName = HouseName(raw.trim())
    }
}
