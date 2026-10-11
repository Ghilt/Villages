package villages.application

import villages.domain.HouseError
import villages.domain.HouseFounded
import villages.domain.HouseId
import villages.domain.NameSeat
import villages.domain.RaiseStructure
import villages.domain.StructureError
import villages.domain.StructureId
import villages.domain.StructureRaised
import villages.domain.StructureType

/**
 * The seats listener: founding a house raises its castle, at the place it was founded, held by the house, and names
 * it the house's seat. The founding is on the house's stream, the castle on its own, and the naming back on the
 * house's, and no one decision can write all three, so a reaction carries it, in the founding's story: `raised`,
 * then `namedSeat` - and then the standing-effects listener lets the house see from it.
 *
 * **Either order heals, and a replay writes nothing.** A founding raises the castle under an id worked out from the
 * house, refused `alreadyRaised` the second time; the castle raised names itself the seat, refused `seatNamedBefore`
 * once the house has named one. Both refusals are swallowed, as every reaction's "already done" is, so the history
 * heard again on a start asks twice and writes nothing. A house founded before there were seats gets its castle the
 * first time this listener hears of it. See docs/plans/structures.md and decision record 0092.
 */
class Seats(
    feed: EventFeed,
    later: Later,
    faults: Faults,
    private val structures: StructureCommandExecutor,
    private val houses: HouseCommandExecutor,
    private val clock: Clock,
) : Reaction("the seats listener", feed, later, faults) {
    override fun apply(stored: StoredEvent) {
        when (val event = stored.event) {
            is HouseFounded -> raiseCastle(event, stored)
            is StructureRaised -> event.holder?.takeIf { StructureId.seatOf(it) == event.structureId }?.let { house ->
                nameSeat(house, event, stored)
            }
            else -> Unit
        }
    }

    private fun raiseCastle(founded: HouseFounded, because: StoredEvent) {
        issueLater("raising the castle of ${founded.houseId.stream}", settled = setOf(StructureError.AlreadyRaised::class)) {
            structures.execute(
                RaiseStructure(
                    structureId = StructureId.seatOf(founded.houseId),
                    structureType = CASTLE,
                    name = "${founded.name.value} Castle",
                    place = founded.seat,
                    level = 1,
                    holder = founded.houseId,
                    worldTime = founded.worldTime,
                    recordedAt = clock.now(),
                ),
                Provenance.continuing(because),
            )
        }
    }

    private fun nameSeat(house: HouseId, raised: StructureRaised, because: StoredEvent) {
        issueLater("naming ${raised.structureId.stream} the seat of ${house.stream}", settled = setOf(HouseError.SeatNamedBefore::class)) {
            houses.execute(NameSeat(house, raised.structureId, raised.worldTime, clock.now()), Provenance.continuing(because))
        }
    }

    /** Nothing is folded: every decision is the streams' own. */
    override fun forget() {}

    private companion object {
        /** What founding raises: the catalogue's castle, as the founding seat has always been drawn. */
        val CASTLE = StructureType("castle")
    }
}
