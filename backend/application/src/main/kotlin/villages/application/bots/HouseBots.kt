package villages.application.bots

import villages.application.Clock
import villages.application.FoundHouseService
import villages.application.FoundingChoices
import villages.application.Provenance
import villages.application.WorldClock
import villages.application.WorldCommandExecutor
import villages.domain.Bot
import villages.domain.CreateBots
import villages.domain.HouseError
import villages.domain.HouseId
import villages.domain.PlayerId
import java.util.Random
import java.util.UUID

/**
 * The world's house bots, made at the opening: each bot the world lacks is recorded on the world's own stream, and
 * then every one founds its house as its own player, as any house is founded, the refusal of one founded already
 * swallowed. Asking again makes nothing twice, so the opening asks for every bot every time. See decision record 0108.
 */
class HouseBots(
    private val world: WorldCommandExecutor,
    private val houses: FoundHouseService,
    /** Where the bots stand now: worked out from the world's master and the balance, none when it has no ground. */
    private val places: () -> List<HouseBotPlace>,
    private val clock: Clock,
    private val worldClock: WorldClock,
) {
    /** Makes every bot the world lacks and has every one without a house found it; says how many it asked for. */
    fun open(): Int {
        val here = places()
        if (here.isEmpty()) return 0
        val bots = here.map { Bot(PlayerId.botAt(it.town), it.town) }
        world.execute(CreateBots(bots, worldClock.today(), clock.now()), Provenance.startedBy(MAKING))
        for ((place, bot) in here.zip(bots)) {
            try {
                houses.found(
                    houseId = HouseId.of(bot.player),
                    player = bot.player,
                    name = place.name,
                    seat = place.seat,
                    banner = FoundingChoices.bannerFrom(Random(bot.player.value.mostSignificantBits)),
                    provenance = Provenance.startedBy(foundingOf(bot)),
                )
            } catch (_: HouseError.AlreadyFounded) {
                // Founded at an opening before this one: the bot's house is history, and stays as it was.
            }
        }
        return here.size
    }

    private companion object {
        /** The story every opening's making of bots is told in: the same each time, as only the first writes. */
        val MAKING: UUID = UUID.nameUUIDFromBytes("villages:opening:bots".toByteArray(Charsets.UTF_8))

        /** The story a bot's founding is told in, its own. */
        fun foundingOf(bot: Bot): UUID =
            UUID.nameUUIDFromBytes("villages:opening:bot:${bot.town}".toByteArray(Charsets.UTF_8))
    }
}
