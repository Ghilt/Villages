package villages.application

import villages.domain.CharacterCommand
import villages.domain.HouseCommand
import villages.domain.StructureCommand

/** Runs a command against its house's stream: load, decide, append. Throws a HouseError when refused. */
fun interface HouseCommandExecutor {
    fun execute(command: HouseCommand, provenance: Provenance)
}

/**
 * Runs a command against its character's stream: load, decide, append. Throws a CharacterError when refused.
 * A port of its own rather than one generic one, so that a test's fake can be both. See decision 0055.
 */
fun interface CharacterCommandExecutor {
    fun execute(command: CharacterCommand, provenance: Provenance)
}

/** Runs a command against its structure's stream: load, decide, append. Throws a StructureError when refused. 0092. */
fun interface StructureCommandExecutor {
    fun execute(command: StructureCommand, provenance: Provenance)
}

/**
 * Another writer reached the stream first and the command was not applied.
 *
 * Not a `HouseError`: the decider refused nothing, and the same command tried again against the stream
 * as it now stands may well be accepted. The executor retries a few times before giving up and throwing
 * this, so seeing it means the stream is genuinely busy. See decision record 0035.
 */
class WriteConflict(val stream: String, val expectedVersion: Long) :
    RuntimeException("$stream moved on from version $expectedVersion while the command was being decided")
