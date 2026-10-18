package villages.gateway

import villages.application.ResourceService
import villages.domain.PledgeId
import villages.protocol.GrantResourcePayload
import villages.protocol.PledgeResourcePayload
import villages.protocol.ReleasePledgePayload
import villages.protocol.SpendResourcePayload

/**
 * The resources in the gateway: Adam's levers granting, spending, pledging and releasing, standing in for the world,
 * which does none of it yet, and refused when the instruments are closed (0076). What a house has reaches its player
 * through its house, so this part greets nobody. See decision record 0006.
 */
internal class ResourcesPart(private val open: Boolean, private val resources: ResourceService) : Part {
    override fun register(commands: Commands, frames: Frames) {
        commands.lever<GrantResourcePayload>(open) { asking, payload ->
            resources.grant(
                player = asking.who,
                resource = asResource(payload.resource),
                amount = payload.amount,
                provenance = asking.startingAStory,
            )
        }
        commands.lever<SpendResourcePayload>(open) { asking, payload ->
            resources.spend(
                player = asking.who,
                resource = asResource(payload.resource),
                amount = payload.amount,
                provenance = asking.startingAStory,
            )
        }
        commands.lever<PledgeResourcePayload>(open) { asking, payload ->
            resources.pledge(
                player = asking.who,
                resource = asResource(payload.resource),
                amount = payload.amount,
                months = payload.months,
                purpose = payload.purpose,
                provenance = asking.startingAStory,
            )
        }
        commands.lever<ReleasePledgePayload>(open) { asking, payload ->
            resources.release(
                player = asking.who,
                pledgeId = PledgeId(asUuid(payload.pledgeId, "a pledge id")),
                provenance = asking.startingAStory,
            )
        }
    }
}

/** The resources' place in the gateway: levers only, so its number says nothing of a greeting. */
class ResourcesMechanic(private val resources: ResourceService) : GatewayMechanic(greeting = 1250) {
    override fun part(made: Made): Part = ResourcesPart(made.open, resources)
}
