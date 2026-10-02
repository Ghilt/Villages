package villages.gateway

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import villages.protocol.ClientFrame
import villages.protocol.CommandPayload
import villages.protocol.GrantResourcePayload
import villages.protocol.Ping
import villages.protocol.WatchEvents

/**
 * The gateway's parts, one a mechanic, and the two registries they put what they take into: every command and
 * every frame the protocol has is taken by exactly one part, or by the core. See decision record 0075.
 */
class GatewayPartsSpec : StringSpec({

    "every kind of command the protocol has is taken by exactly one part of the gateway" {
        Rig().gateway.commandKinds shouldBe CommandPayload::class.sealedSubclasses.toSet()
    }

    "every kind of frame a page sends is answered by the core or by exactly one part, never both" {
        val parts = Rig().gateway.frameKinds

        (parts intersect CORE_FRAMES).shouldBeEmpty()
        parts + CORE_FRAMES shouldBe ClientFrame::class.sealedSubclasses.toSet()
    }

    "a second handler for a kind is refused as it is put there, so no kind can have two" {
        val commands = Commands()
        commands.on<GrantResourcePayload> { _, _ -> }
        val frames = Frames()
        frames.on<WatchEvents> { _, _ -> }

        shouldThrow<IllegalArgumentException> { commands.on<GrantResourcePayload> { _, _ -> } }
        shouldThrow<IllegalArgumentException> { frames.on<WatchEvents> { _, _ -> } }
        shouldThrow<IllegalArgumentException> { frames.on<Ping> { _, _ -> } }
    }
})
