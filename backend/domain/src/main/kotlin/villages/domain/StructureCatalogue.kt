package villages.domain

/**
 * Every type of structure there is, and what each is at each of its levels: the part of `world/catalogues/structures.json` the
 * rules read. The words a culture calls a type by, its size on the map and its influence zone are the page's and are
 * not here. Read once when the server starts and handed to whatever decides by it, so every rule of a running
 * server reads the same numbers. A catalogue that breaks one of the rules below is refused whole, and the server with
 * it: a type nobody can raise is better than one raised with half its numbers. See decision record 0093.
 */
data class StructureCatalogue(val types: Map<StructureType, StructureSpec>) {
    init {
        require(types.isNotEmpty()) { "a catalogue lists at least one type of structure" }
    }

    fun of(type: StructureType): StructureSpec? = types[type]
}

/** The sort of a structure, by its name in the catalogue: `mill`, `printingHouse`. Not scenery's kind. */
@JvmInline
value class StructureType(val name: String) {
    init {
        require(NAME.matches(name)) { "a structure type is named in lower camel case, not '$name'" }
    }

    /** Its name as words, for a name the world gives it before anyone names it better: `printingHouse`, printing house. */
    val inWords: String get() = name.replace(Regex("[A-Z]")) { " ${it.value.lowercase()}" }

    override fun toString(): String = name

    companion object {
        private val NAME = Regex("[a-z][a-zA-Z]{0,39}")
    }
}

/** One type: what it is at each level, the first first, and its slots. */
data class StructureSpec(val levels: List<LevelSpec>, val slots: List<SlotSpec>) {
    init {
        require(levels.isNotEmpty()) { "a type of structure has at least one level" }
        require(slots.all { it.places.size == levels.size }) { "every slot says its places at each of the ${levels.size} levels" }
        require(slots.map { it.name }.toSet().size == slots.size) { "a type's slots have a name apiece" }
    }

    /** The highest level a structure of this type can rise to; the lowest is one. */
    val highest: Int get() = levels.size

    /** What it is at [level], from one to [highest]. */
    fun at(level: Int): LevelSpec {
        require(level in 1..highest) { "a level runs from 1 to $highest, not $level" }
        return levels[level - 1]
    }
}

/**
 * A type at one level: how far out it is drawn, how far its holder sees round it, and what it yields its holder a
 * world month while held. Every structure sees a little, so a holding is always in its holder's sight.
 */
data class LevelSpec(val significance: Significance, val sightKm: Double, val yieldsPerMonth: Map<Resource, Double>) {
    init {
        require(sightKm > 0.0 && sightKm.isFinite()) { "every structure sees a little, not $sightKm km" }
        require(yieldsPerMonth.values.all { it >= 0.0 && it.isFinite() }) { "a yield is nothing or more, not $yieldsPerMonth" }
    }
}

/**
 * A place in a structure that takes something, and how what fills it counts. Strict about how many - [places] at
 * each level, never fewer as the level rises - and permissive about what: [takes] is what the slot is for, which the
 * levers follow, and a story may put anything in it.
 */
data class SlotSpec(
    val name: String,
    val takes: Takes,
    val places: List<Int>,
    val seenBy: SeenBy,
    /** The type gives nothing while this slot is empty: a palace without a king on its throne. */
    val needed: Boolean = false,
    /** What each filled place gives, a world month: a prisoner in the cells, a ship at the moorings. */
    val adds: Map<Resource, Double> = emptyMap(),
    /** The stat of the character in it that what the type gives follows: a pious bishop, an able factor. */
    val scales: Stat? = null,
    /** An item in it gives its own standing effects to whoever holds the structure: a relic in the reliquary. */
    val bringsItsOwn: Boolean = false,
) {
    init {
        require(name.isNotBlank()) { "a slot has a name" }
        require(places.all { it >= 0 }) { "the $name slot has no fewer than no places" }
        require(places.zipWithNext().all { (lower, higher) -> higher >= lower }) {
            "the $name slot never has fewer places a level higher, not $places"
        }
        require(adds.values.all { it >= 0.0 && it.isFinite() }) { "what the $name slot adds is nothing or more" }
    }

    /** How many places it has at a level: the catalogue's, or its highest level's past the end of the list. */
    fun placesAt(level: Int): Int = places.getOrElse(level - 1) { places.lastOrNull() ?: 0 }
}

/** What a slot is for: a person, a thing, or either. */
enum class Takes { CHARACTER, ITEM, EITHER }

/** Who may see into a slot: whoever sees the structure, or its holder alone. Another house sees a question mark. */
enum class SeenBy { ALL, HOLDER }
