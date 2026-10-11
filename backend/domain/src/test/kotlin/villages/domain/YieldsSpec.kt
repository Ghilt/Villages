package villages.domain

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import java.util.UUID

/** What a structure yields its holder a month, what fills its slots counted by each slot's rule. */
class YieldsSpec : StringSpec({
    val agnes = CharacterId(UUID.fromString("cb732500-39bd-3b39-a838-bb89f719578f"))
    val wilhelm = CharacterId(UUID.fromString("cb732500-39bd-3b39-a838-bb89f719578e"))
    fun person(id: CharacterId) = Content.Person(id)
    fun level(vararg yields: Pair<Resource, Double>) = LevelSpec(Significance(10.0), 6.0, mapOf(*yields))
    val nobodyKnown: (CharacterId, Stat) -> Int? = { _, _ -> null }

    "with nothing in its slots it yields its type's at its level" {
        val mill = StructureSpec(listOf(level(Resource.WEALTH to 6.0), level(Resource.WEALTH to 12.0)), emptyList())

        Yields.of(mill, 2, emptyMap(), nobodyKnown) shouldBe mapOf(Resource.WEALTH to 12.0)
    }

    "a needed slot left empty, and the type gives nothing of its own" {
        val palace = StructureSpec(
            listOf(level(Resource.INFLUENCE to 8.0)),
            listOf(SlotSpec("throne", Takes.CHARACTER, listOf(1), SeenBy.ALL, needed = true)),
        )

        Yields.of(palace, 1, emptyMap(), nobodyKnown) shouldBe emptyMap()
        Yields.of(palace, 1, mapOf("throne" to listOf(person(agnes))), nobodyKnown) shouldBe mapOf(Resource.INFLUENCE to 8.0)
    }

    "a living person in a slot that scales scales it by their stat over ten; nobody, or the dead, leave it as written" {
        val cathedral = StructureSpec(
            listOf(level(Resource.PIETY to 6.0)),
            listOf(SlotSpec("bishop", Takes.CHARACTER, listOf(1), SeenBy.ALL, scales = Stat.PIETY)),
        )
        val pious: (CharacterId, Stat) -> Int? = { id, stat -> if (id == agnes && stat == Stat.PIETY) 15 else null }

        Yields.of(cathedral, 1, mapOf("bishop" to listOf(person(agnes))), pious) shouldBe mapOf(Resource.PIETY to 9.0)
        Yields.of(cathedral, 1, mapOf("bishop" to listOf(person(wilhelm))), pious) shouldBe mapOf(Resource.PIETY to 6.0)
        Yields.of(cathedral, 1, emptyMap(), pious) shouldBe mapOf(Resource.PIETY to 6.0)
    }

    "every filled place of a slot that adds adds its amount, and an item where an item's own is taken yields it" {
        val prison = StructureSpec(
            listOf(level()),
            listOf(
                SlotSpec("cells", Takes.CHARACTER, listOf(4), SeenBy.HOLDER, adds = mapOf(Resource.INFLUENCE to 1.0)),
                SlotSpec("chapel", Takes.ITEM, listOf(1), SeenBy.ALL, bringsItsOwn = true),
                SlotSpec("store", Takes.ITEM, listOf(1), SeenBy.ALL),
            ),
        )
        val relic = Content.Item(ContentId(UUID.randomUUID()), "a relic", "", null, mapOf(Resource.PIETY to 2.0))

        Yields.of(
            prison, 1,
            mapOf(
                "cells" to listOf(person(agnes), person(wilhelm)),
                "chapel" to listOf(relic),
                "store" to listOf(relic.copy(itemId = ContentId(UUID.randomUUID()))),
            ),
            nobodyKnown,
        ) shouldBe mapOf(Resource.INFLUENCE to 2.0, Resource.PIETY to 2.0)
    }
})
