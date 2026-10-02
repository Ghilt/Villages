package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.string.shouldStartWith
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldNotBeEmpty
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.shouldBe
import villages.protocol.Batch
import villages.protocol.CommandAccepted
import villages.protocol.CommandRejected
import villages.protocol.YourHouse

/** The gateway: what a house has, granted, spent and pledged, and who is told. The rig is GatewayRig.kt. */
class GatewayResourcesSpec : StringSpec({

    "what a house has reaches its owner, and reaches nobody else" {
        val rig = Rig()
        val (founder, mine) = rig.introduced()
        val (neighbour, theirs) = rig.someoneElse(fogLifted = true)
        neighbour.receive(subscribe(STOCKHOLM_Z10))
        theirs.clear()

        founder.receive(founding())
        // The neighbour's deltas are coalesced, so nothing reaches them until the flush comes due.
        rig.later.tick()

        // The owner is told all five, under their wire names, which are the code's and not the player's.
        val yours = mine.filterIsInstance<YourHouse>().last().yours!!
        yours.resources.keys shouldContainExactlyInAnyOrder
            setOf("wealth", "naturalDomain", "influence", "reason", "piety")
        yours.resources.getValue("wealth").total shouldBe 0
        yours.resources.getValue("wealth").pledged shouldBe 0
        yours.pledges.shouldBeEmpty()

        // The neighbour holding the cell sees the house arrive and is told nothing of what it has. A
        // `yourHouse` is only ever about your own, and the public view has nowhere to carry a resource,
        // so the privacy is the shape rather than a rule anybody has to remember. See decision 0028.
        theirs.filterIsInstance<YourHouse>().shouldBeEmpty()
        theirs.filterIsInstance<Batch>().flatMap { it.deltas }.shouldNotBeEmpty()
    }

    "a granted resource comes back on the owner's own house, and a spend takes it off again" {
        val rig = Rig()
        val (founder, mine) = rig.introduced()
        founder.receive(founding())

        founder.receive(granting(amount = 120))

        mine.filterIsInstance<CommandAccepted>().map { it.commandId } shouldContain COMMAND_TWO
        mine.filterIsInstance<YourHouse>().last().yours!!.resources.getValue("wealth").total shouldBe 120

        founder.receive(spending(amount = 50, commandId = COMMAND_THREE))

        mine.filterIsInstance<YourHouse>().last().yours!!.resources.getValue("wealth").total shouldBe 70
    }

    "a pledge is asked for in months and comes back as a day, held against what is free" {
        val rig = Rig()
        val (founder, mine) = rig.introduced()
        founder.receive(founding())
        founder.receive(granting(resource = "reason", amount = 100))

        founder.receive(pledging(amount = 35, months = 10, commandId = COMMAND_THREE))

        val yours = mine.filterIsInstance<YourHouse>().last().yours!!
        yours.resources.getValue("reason").total shouldBe 100
        yours.resources.getValue("reason").pledged shouldBe 35
        val pledge = yours.pledges.single()
        pledge.amount shouldBe 35
        pledge.purpose shouldBe "clearer glass"
        // Ten months on, by the calendar this rig was given. What a month is belongs to the calendar.
        pledge.until shouldBe today.day + 300

        founder.receive(releasing(pledge.id, commandId = COMMAND_FOUR))

        val freed = mine.filterIsInstance<YourHouse>().last().yours!!
        freed.pledges.shouldBeEmpty()
        freed.resources.getValue("reason").pledged shouldBe 0
    }

    "a resource nobody has heard of is refused as malformed rather than guessed at" {
        val rig = Rig()
        val (founder, mine) = rig.introduced()
        founder.receive(founding())

        founder.receive(granting(resource = "domain", amount = 5, commandId = COMMAND_TWO))

        // `domain` is the player's word; the wire's is `naturalDomain`, and the gateway does not translate.
        mine.filterIsInstance<CommandRejected>().single().reason shouldStartWith "malformed"
    }

    "spending more than is free is refused, and says so" {
        val rig = Rig()
        val (founder, mine) = rig.introduced()
        founder.receive(founding())

        founder.receive(spending(amount = 1, commandId = COMMAND_TWO))

        mine.filterIsInstance<CommandRejected>().single().reason shouldBe "notEnoughFree"
    }
})
