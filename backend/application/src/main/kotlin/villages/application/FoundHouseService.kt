package villages.application

import villages.domain.Banner
import villages.domain.FoundHouse
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.PlayerId

/**
 * The first use case: a player founds a house. It stamps both times on the command - the world's day and
 * the server's instant - and hands it to whatever executes commands. The rules are the decider's, in the
 * domain; this is only the seam between a request and the stream.
 */
class FoundHouseService(
    private val executor: HouseCommandExecutor,
    private val clock: Clock,
    private val world: WorldClock,
) {
    /** Throws a HouseError when the decider refuses, exactly as the decider threw it. */
    fun found(
        houseId: HouseId,
        player: PlayerId,
        name: HouseName,
        seat: Location,
        banner: Banner,
        provenance: Provenance,
    ) {
        executor.execute(
            FoundHouse(
                houseId = houseId,
                player = player,
                name = name,
                seat = seat,
                banner = banner,
                worldTime = world.today(),
                recordedAt = clock.now(),
            ),
            provenance,
        )
    }
}

/** Anonymous tokens are the player's UUID as text, made in the browser. Anything else is refused. */
object AnonymousTokens : PlayerTokens {
    override fun playerOf(token: String): PlayerId =
        PlayerId(
            runCatching { java.util.UUID.fromString(token) }
                .getOrElse { throw IllegalArgumentException("not a player token: $token") },
        )
}
