package villages.domain

/**
 * What a structure yields whoever holds it, a world month: its type's at its level, and what fills its slots counted
 * by each slot's rule. Pure, so that the listener that pays a house and the window that says what a holding gives
 * work it out alike. A ruin is asked nothing: it gives nothing. See docs/plans/structures.md.
 *
 * - A slot that is **needed** and empty, a palace with nobody on its throne: the type gives nothing of its own.
 * - A slot that **scales** by a stat: a living person in it scales what the type gives by that stat over
 *   [STAT_PAR], so a stat of ten gives the catalogue's numbers, fifteen half again, five half; with nobody living in
 *   it the type gives the catalogue's numbers.
 * - A slot that **adds**: every filled place adds the slot's amount, a prisoner in the cells, a ship at the moorings.
 * - A slot whose item **brings its own**: each item in it yields its own, a relic in the reliquary.
 *
 * The numbers are placeholders for Adam to tune, the par among them.
 */
object Yields {
    /** The stat that gives a type's numbers as the catalogue writes them. */
    const val STAT_PAR = 10.0

    /**
     * What a structure of [spec] at [level], its slots holding [slots], yields a month; [statOf] says a person's stat,
     * or null for one who is dead or not known, and they then count as nobody.
     */
    fun of(
        spec: StructureSpec,
        level: Int,
        slots: Map<String, List<Content>>,
        statOf: (CharacterId, Stat) -> Int?,
    ): Map<Resource, Double> {
        val emptyNeeded = spec.slots.any { it.needed && slots[it.name].isNullOrEmpty() }
        val scale = spec.slots.fold(1.0) { by, slot ->
            val stat = slot.scales ?: return@fold by
            val person = slots[slot.name].orEmpty().filterIsInstance<Content.Person>().firstNotNullOfOrNull { statOf(it.characterId, stat) }
            if (person == null) by else by * person / STAT_PAR
        }
        val own = if (emptyNeeded) emptyMap() else spec.at(level).yieldsPerMonth.mapValues { (_, amount) -> amount * scale }
        val added = spec.slots.flatMap { slot ->
            val held = slots[slot.name].orEmpty()
            slot.adds.map { (resource, each) -> resource to each * held.size } +
                if (slot.bringsItsOwn) held.filterIsInstance<Content.Item>().flatMap { it.yields.toList() } else emptyList()
        }
        return (own.toList() + added)
            .groupBy({ it.first }, { it.second })
            .mapValues { (_, amounts) -> amounts.sum() }
            .filterValues { it != 0.0 }
    }
}
