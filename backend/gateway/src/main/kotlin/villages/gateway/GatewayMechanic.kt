package villages.gateway

import villages.application.WorldClock

/**
 * One mechanic's place in the gateway, as the app wires it: the ports its part is made from, handed to the gateway as
 * one bean from the mechanic's own configuration, `QuestsConfig` and the rest, and the part made from them once the
 * gateway has a core to hand it. So a mechanic is wired where it is, and the gateway's own wiring - `GatewayConfig`,
 * [Mechanics], [partsOf] - is not edited for it. See `docs/plans/mechanic-modules.md`, step 5.
 *
 * Made only in this module, where the parts are, so the part stays the gateway's own business.
 */
abstract class GatewayMechanic internal constructor(
    /**
     * Where its part stands among the others, which is the order a player arriving is told things in: see [partsOf]
     * for the numbers every part stands at. Two parts never share one.
     */
    internal val greeting: Int,
) {
    /** Its part, made once, as the gateway is made. */
    internal abstract fun part(made: Made): Part
}

/**
 * What the gateway hands a mechanic as its part is made: the core, whether Adam's instruments are open, which says
 * whether its levers are pulled or refused (0076), and the world's clock.
 */
internal class Made(val core: Core, val open: Boolean, val world: WorldClock)
