package villages.domain

import java.time.Instant

/**
 * Where some of a house's income comes from: a structure it holds, today, named by its stream; later perhaps
 * something in a slot, or a story. Opaque to the treasury, which only adds up what each source pays.
 */
@JvmInline
value class IncomeSource(val name: String) {
    init {
        require(name.isNotBlank()) { "an income comes from somewhere" }
    }

    override fun toString(): String = name

    companion object {
        /** What a structure pays its holder is paid under the structure's own stream. */
        fun of(structure: StructureId): IncomeSource = IncomeSource(structure.stream)
    }
}

/**
 * What a house is paid, source by source, in each resource per second, and nothing that pays nothing. A stock's
 * rate is the sum over its sources, re-based each time one changes, so the past keeps the meaning it had: what was
 * paid is what was written. See docs/plans/structures.md.
 */
data class Incomes(val bySource: Map<IncomeSource, Map<Resource, Double>> = emptyMap()) {
    /** What one source pays, by resource per second; nothing for a source that pays nothing. */
    fun of(source: IncomeSource): Map<Resource, Double> = bySource[source].orEmpty()

    /** How fast a resource comes in, from every source together, per second. */
    fun rateOf(resource: Resource): Double = bySource.values.sumOf { it[resource] ?: 0.0 }

    /** These incomes with one source paying [rates] instead, or gone when it pays nothing. */
    fun with(source: IncomeSource, rates: Map<Resource, Double>): Incomes {
        val paying = paying(rates)
        return Incomes(if (paying.isEmpty()) bySource - source else bySource + (source to paying))
    }

    /**
     * [stocks] brought up to [at] and set running at these incomes' rates, where a rate differs from what they ran
     * at; the rest as they were, so a stock re-based on every change keeps everything it had come to.
     */
    fun rebased(stocks: Map<Resource, Stock>, at: Instant): Map<Resource, Stock> = stocks.mapValues { (resource, stock) ->
        val rate = rateOf(resource)
        if (rate == stock.ratePerSecond) stock else Stock(stock.at(at), rate, at)
    }

    companion object {
        /**
         * How many real seconds a world month lasts: a real day is a world month (0053). The catalogue's yields are
         * written per month, which is the unit a person thinks in, and the wire carries per second.
         */
        const val SECONDS_A_MONTH = 86_400.0

        /** Rates without the resources they pay nothing of, so two sources paying the same compare equal. */
        fun paying(rates: Map<Resource, Double>): Map<Resource, Double> = rates.filterValues { it != 0.0 }
    }
}
