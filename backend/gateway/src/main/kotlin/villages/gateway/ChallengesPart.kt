package villages.gateway

import villages.application.ChallengeSimulator
import villages.application.SetupRefused
import villages.protocol.ServerFrame
import villages.protocol.SimulateChallenge
import villages.protocol.SimulationRefused

/**
 * The challenge in the gateway: the simulator's page has the engine fight a challenge out, answered only to itself
 * with every moment, or refused with every reason the setup cannot be fought. An instrument, so a server with its
 * instruments closed refuses it, and nothing is stored; nobody arriving is told anything. See decision record 0107.
 */
internal class ChallengesPart(
    private val open: Boolean,
    private val simulator: ChallengeSimulator,
    private val fingerprint: () -> String,
) : Part {
    override fun register(commands: Commands, frames: Frames) {
        frames.on<SimulateChallenge> { connection, frame -> connection.out.send(fought(frame)) }
    }

    private fun fought(frame: SimulateChallenge): ServerFrame {
        if (!open) return SimulationRefused(frame.id, "instrumentsClosed", "simulateChallenge is one of the instruments, and they are closed here")
        return try {
            simulator.simulate(
                frame.a.map { it.toSlice() },
                frame.b.map { it.toSlice() },
                frame.progression?.toProgression(),
                frame.kind,
                frame.seed,
                frame.runs ?: 1,
            ).toFrame(frame.id, fingerprint())
        } catch (refused: SetupRefused) {
            SimulationRefused(frame.id, "invalidSetup", refused.message ?: "the setup cannot be fought")
        } catch (unreadable: IllegalArgumentException) {
            SimulationRefused(frame.id, "invalidSetup", unreadable.message ?: "the setup cannot be read")
        }
    }
}

/** The challenge's place in the gateway: an instrument only, greeting nobody, after the inspect pages' own. */
class ChallengesMechanic(private val simulator: ChallengeSimulator, private val fingerprint: () -> String) : GatewayMechanic(greeting = 1700) {
    override fun part(made: Made): Part = ChallengesPart(made.open, simulator, fingerprint)
}
