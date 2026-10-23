package villages.domain

import villages.domain.challenge.ChallengeResult
import villages.domain.challenge.ChallengeSetup
import java.util.UUID

/** The identity of one challenge a house fought, so its history can name it and its run be asked for again. */
@JvmInline
value class ChallengeId(val value: UUID) {
    companion object {
        /** What a challenge is named after, so the derivation cannot collide with anything else. */
        private const val NAMED_AFTER = "villages:challenge:"

        /**
         * The challenge a command accepts. Worked out rather than minted, as a quest's identity is, so the same command
         * sent twice names one challenge; the house in the name as well as the command, because a command's id is
         * public.
         */
        fun accepted(house: HouseId, commandId: UUID): ChallengeId =
            ChallengeId(UUID.nameUUIDFromBytes("$NAMED_AFTER${house.value}:$commandId".toByteArray(Charsets.UTF_8)))
    }
}

/**
 * A challenge fought out, ready for the house to take: its [kind], what each side brought and its progression, what
 * it came to - from its seed, the moments and the outcome - and the [catalogue] and [engine] it was fought under. The
 * application fights it, as it draws a fate roll, because the luck is the seed and the seed is the application's; the
 * house checks it was fought on the terms the node put and with slices of its own. See decision record 0107, amended.
 */
data class FoughtChallenge(
    val kind: String,
    val setup: ChallengeSetup,
    val result: ChallengeResult,
    val catalogue: String,
    val engine: Int,
)
