package villages.application

import villages.domain.Banner
import villages.domain.Charge
import villages.domain.Choice
import villages.domain.ChoiceId
import villages.domain.Division
import villages.domain.Effect
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.Option
import villages.domain.OptionId
import villages.domain.PlayerId
import villages.domain.Tincture
import java.util.Random
import java.util.UUID

/**
 * The first thing the world asks a player: where shall the house raise its seat?
 *
 * Three seats in three different regions, each with a name and a banner of its own, so that taking one is
 * taking a destiny rather than picking a coordinate. The words are content and live here; the decider
 * reads only the effect. See decision record 0034 and docs/MECHANICS.md.
 *
 * Everything is worked out from the player, so the same player is offered the same three however often
 * this is asked. `java.util.Random` rather than `kotlin.random`, because its sequence is specified and
 * will not move under us between Kotlin versions. The choice is recorded on the event that gives it, so
 * nothing downstream ever regenerates it; determinism is here for the test and for explicability.
 */
object FoundingChoices {
    /** How many seats a player is offered. Three is a choice; two is a coin and four is a menu. */
    const val OFFERED = 3

    private const val NAMED_AFTER = "villages:choice:founding:"

    private val NAMES = listOf(
        "Ravenscar", "Hollin", "Thornwick", "Ashby", "Greymere", "Corvane", "Ellerby", "Marrow",
        "Blackwater", "Duncarrow", "Fenwold", "Harrowgate", "Ilminster", "Kettleby", "Lanthorn", "Mordaunt",
    )

    private val METALS = listOf(Tincture.OR, Tincture.ARGENT)
    private val COLOURS = listOf(Tincture.GULES, Tincture.AZURE, Tincture.SABLE, Tincture.VERT, Tincture.PURPURE)

    /**
     * The founding choice for this player: three seats, three regions, three destinies.
     *
     * The wobble is why two players offered the same seat do not found on the same pixel. It is a fraction
     * of a degree, so a seat stays the place it is named after and stays on the ground it was checked on.
     */
    fun forPlayer(player: PlayerId): Choice {
        val rolling = Random(seedOf(player))
        val chosen = regionsFor(rolling).map { region ->
            val inRegion = Gazetteer.seats.filter { it.region == region }
            inRegion[rolling.nextInt(inRegion.size)]
        }
        // Drawn without replacement: three destinies wearing two names between them is not three.
        val names = NAMES.toMutableList()

        return Choice(
            id = ChoiceId(idFor(player, "choice")),
            prompt = "Where shall the house raise its seat?",
            options = chosen.mapIndexed { index, seat ->
                val name = HouseName(names.removeAt(rolling.nextInt(names.size)))
                val banner = bannerFrom(rolling)
                Option(
                    id = OptionId(idFor(player, "option:$index")),
                    label = "${seat.place}, in ${seat.region}",
                    detail = "${seat.detail} The house would take the name ${name.value}, ${blazon(banner)}.",
                    effect = Effect.FoundAt(
                        seat = wobbled(seat.where, rolling),
                        name = name,
                        banner = banner,
                    ),
                )
            },
        )
    }

    /** As many different regions as there are seats to offer, drawn in an order of this player's own. */
    private fun regionsFor(rolling: Random): List<String> =
        Gazetteer.regions.toMutableList().also { left ->
            require(left.size >= OFFERED) { "the gazetteer has fewer than $OFFERED regions in it" }
        }.let { left ->
            List(OFFERED) { left.removeAt(rolling.nextInt(left.size)) }
        }

    /** The same player, the same three seats: a stable seed out of both halves of their identity. */
    private fun seedOf(player: PlayerId): Long =
        player.value.mostSignificantBits xor player.value.leastSignificantBits

    private fun idFor(player: PlayerId, part: String): UUID =
        UUID.nameUUIDFromBytes("$NAMED_AFTER${player.value}:$part".toByteArray(Charsets.UTF_8))

    /** Up to a third of a degree off the named place, so that two houses never share a pixel. */
    private fun wobbled(where: Location, rolling: Random): Location = Location(
        lat = where.lat + (rolling.nextDouble() - 0.5) * WOBBLE,
        lon = where.lon + (rolling.nextDouble() - 0.5) * WOBBLE,
    )

    private const val WOBBLE = 0.66

    /**
     * A banner the rule of tincture allows: a colour charge on a metal field, or the reverse. A house bot's is drawn
     * by it too, from a roll seeded by its player, so it keeps its banner at every opening (0108).
     */
    internal fun bannerFrom(rolling: Random): Banner {
        val metalField = rolling.nextBoolean()
        val field = if (metalField) METALS[rolling.nextInt(METALS.size)] else COLOURS[rolling.nextInt(COLOURS.size)]
        val charge = if (metalField) COLOURS[rolling.nextInt(COLOURS.size)] else METALS[rolling.nextInt(METALS.size)]
        return Banner(
            field = field,
            division = Division.PLAIN,
            second = null,
            charge = Charge.entries[rolling.nextInt(Charge.entries.size)],
            chargeTincture = charge,
        )
    }

    /** A banner in the words a herald would use, for the parchment: "under sable, a stag argent". */
    private fun blazon(banner: Banner): String =
        "under ${banner.field.name.lowercase()}, " +
            "a ${banner.charge.name.lowercase()} ${banner.chargeTincture.name.lowercase()}"
}
