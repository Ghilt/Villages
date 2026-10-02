package villages.domain

import java.time.Instant

/**
 * What a house has: a stock of every resource, and what of it is spoken for. The part of a founded house that
 * decides its resource commands and folds its resource events, and nothing else. See decision record 0075.
 */
data class Treasury(
    /** One stock of every resource. A house always has all five, even when they are nothing. */
    val resources: Map<Resource, Stock>,
    /** What is spoken for, and the only record of it. See `Pledge`. */
    val pledges: List<Pledge> = emptyList(),
) {
    /** What this house has of one resource. A founded house has all five, so this never misses. */
    fun stockOf(resource: Resource): Stock = resources.getValue(resource)

    /** How much of one resource is spoken for: the sum of the live pledges against it, and nothing stored. */
    fun pledgedOf(resource: Resource): Long =
        pledges.filter { it.resource == resource }.sumOf { it.amount }

    /**
     * How much of one resource the house may actually do something with: what it has now, less what is
     * pledged. Every rule that asks whether a house can afford or attempt a thing asks this.
     */
    fun freeOf(resource: Resource, now: Instant): Long = stockOf(resource).at(now) - pledgedOf(resource)

    /**
     * Whether the house has enough of a resource free to be allowed something. **The gate**, which is
     * what domain and influence are for: it reads, and takes nothing. Nothing calls it yet, because
     * there is nothing to build; it is here because a gate that is a question and not a subtraction is
     * the whole distinction between those two resources and wealth.
     */
    fun has(resource: Resource, wanted: Long, now: Instant): Boolean = freeOf(resource, now) >= wanted

    /** That much of a resource free now, or the refusal. A cost and a pledge both ask it. */
    internal fun enough(resource: Resource, wanted: Long, now: Instant) {
        if (!has(resource, wanted, now)) {
            throw HouseError.NotEnoughFree(resource, wanted, freeOf(resource, now))
        }
    }

    internal fun decide(command: ResourceCommand): List<ResourceEvent> = when (command) {
        is GrantResource -> {
            anAmount(command.amount)
            // Nothing else is checked: what a house may be given, and by what, is a mechanic and not a shape.
            listOf(
                HouseResourceGranted(
                    houseId = command.houseId,
                    resource = command.resource,
                    amount = command.amount,
                    worldTime = command.worldTime,
                    recordedAt = command.recordedAt,
                ),
            )
        }

        is SpendResource -> {
            anAmount(command.amount)
            enough(command.resource, command.amount, command.recordedAt)
            listOf(
                HouseResourceSpent(
                    houseId = command.houseId,
                    resource = command.resource,
                    amount = command.amount,
                    worldTime = command.worldTime,
                    recordedAt = command.recordedAt,
                ),
            )
        }

        is PledgeResource -> {
            anAmount(command.amount)
            if (command.until <= command.worldTime) {
                throw HouseError.InvalidPledge("a pledge comes back after it is made, not before")
            }
            if (command.purpose.isBlank()) {
                throw HouseError.InvalidPledge("a pledge is for something")
            }
            if (pledges.any { it.id == command.pledgeId }) {
                throw HouseError.InvalidPledge("this house has already pledged under that name")
            }
            // Against what is free, not against what there is: twice-pledged reason is reason that was
            // never there. This is the one rule that makes a pledge different from a note in the margin.
            enough(command.resource, command.amount, command.recordedAt)
            listOf(
                HouseResourcePledged(
                    houseId = command.houseId,
                    pledgeId = command.pledgeId,
                    resource = command.resource,
                    amount = command.amount,
                    until = command.until,
                    purpose = command.purpose,
                    worldTime = command.worldTime,
                    recordedAt = command.recordedAt,
                ),
            )
        }

        is ReleasePledge -> {
            if (pledges.none { it.id == command.pledgeId }) {
                throw HouseError.NoSuchPledge
            }
            listOf(
                HouseResourceReleased(
                    houseId = command.houseId,
                    pledgeId = command.pledgeId,
                    worldTime = command.worldTime,
                    recordedAt = command.recordedAt,
                ),
            )
        }
    }

    internal fun evolve(event: ResourceEvent): Treasury = when (event) {
        is HouseResourceGranted -> withStock(event.resource) { it.plus(event.amount, event.recordedAt) }
        is HouseResourceSpent -> withStock(event.resource) { it.minus(event.amount, event.recordedAt) }
        is HouseResourcePledged -> copy(
            pledges = pledges + Pledge(
                id = event.pledgeId,
                resource = event.resource,
                amount = event.amount,
                until = event.until,
                purpose = event.purpose,
            ),
        )
        // Nothing is added back, because nothing was taken away: what is pledged is the sum of this list,
        // so dropping the pledge is the whole of the release.
        is HouseResourceReleased -> copy(pledges = pledges.filterNot { it.id == event.pledgeId })
    }

    /** The treasury with one of its stocks changed. */
    internal fun withStock(resource: Resource, change: (Stock) -> Stock): Treasury =
        copy(resources = resources + (resource to change(stockOf(resource))))

    private fun anAmount(amount: Long) {
        if (amount <= 0) {
            throw HouseError.InvalidAmount("an amount is more than nothing, and $amount is not")
        }
    }
}
