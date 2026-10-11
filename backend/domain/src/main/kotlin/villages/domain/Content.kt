package villages.domain

import java.util.UUID

/** Which content is meant: a person's own id, or an item's, minted when it was first put somewhere. */
@JvmInline
value class ContentId(val value: UUID)

/**
 * What fills a place in a structure's slot: a person, by their id, or an item - a relic, a garrison of forty, three
 * hundred bushels of grain - with a name, a line about it, how many of it or none, and what it yields of its own a
 * world month, which a slot that takes an item's own pays its holder: a relic's piety. An item gets a stream of its own
 * only when one starts to travel by itself; until then where it is is the structures' to say. See
 * docs/plans/structures.md.
 */
sealed interface Content {
    data class Person(val characterId: CharacterId) : Content

    data class Item(
        val itemId: ContentId,
        val name: String,
        val about: String,
        val amount: Long?,
        val yields: Map<Resource, Double> = emptyMap(),
    ) : Content {
        init {
            require(amount == null || amount > 0) { "an item is one, or a number of it, not $amount" }
            require(yields.values.all { it.isFinite() }) { "what an item yields is a number, not $yields" }
        }
    }

    companion object {
        /** Longer than any name a chronicle gives a thing; the bound is there so that a name cannot be a page. */
        const val LONGEST_NAME = 80

        /** A line about it, not a page about it. */
        const val LONGEST_ABOUT = 200
    }
}

/** Which content this is: the person's own id, or the item's. */
val Content.id: ContentId
    get() = when (this) {
        is Content.Person -> ContentId(characterId.value)
        is Content.Item -> itemId
    }
