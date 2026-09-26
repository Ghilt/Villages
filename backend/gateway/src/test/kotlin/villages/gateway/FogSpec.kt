package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.application.CharacterRow
import villages.application.CharacterSpan
import villages.application.Holder
import villages.application.HouseRow
import villages.application.VisionPoint
import villages.application.VisionSource
import villages.domain.Banner
import villages.domain.CharacterId
import villages.domain.CharacterName
import villages.domain.Charge
import villages.domain.Division
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.Sex
import villages.domain.Significance
import villages.domain.Species
import villages.domain.Tincture
import villages.domain.Vision
import villages.domain.WorldTime
import java.util.UUID

private val me = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
private val them = PlayerId(UUID.fromString("6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a"))
private val today = WorldTime(454901)

private val stockholm = Location(59.33, 18.07)
/** A kilometre or so from the seat at Stockholm, well inside its 34. */
private val nearby = Location(59.34, 18.06)
/** Four hundred kilometres off: a vision given here and taken away leaves it revealed. */
private val helsinki = Location(60.17, 24.94)
/** Nowhere the house has ever seen. */
private val paris = Location(48.85, 2.35)

private val banner = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT)

private fun house(of: PlayerId, at: Location, significance: Double = 20.0) = HouseRow(
    id = HouseId.of(of),
    player = of,
    name = HouseName.of("Kestrel"),
    seat = at,
    significance = Significance(significance),
    banner = banner,
    resources = emptyMap(),
    pledges = emptyList(),
    since = today,
    until = null,
    version = 1,
)

private fun person(heldBy: PlayerId? = null) = CharacterRow(
    id = CharacterId(UUID.randomUUID()),
    name = CharacterName("Agnes", "Kestrel"),
    sex = Sex.WOMAN,
    species = Species.PERSON,
    bornOn = WorldTime(today.day - 18 * 365),
    agedYears = 0,
    stats = emptyMap(),
    portrait = null,
    appearedOn = today,
    diedOn = null,
    keyFigureOf = listOfNotNull(heldBy?.let { Holder(HouseId.of(it), HouseName.of("Ravenscar"), banner) }),
    revision = 1,
)

private fun standing(at: Location, significance: Double = 10.0) =
    CharacterSpan(at, Significance(significance), since = today, until = null)

private fun point(at: Location, since: WorldTime = today, until: WorldTime? = null) =
    VisionPoint(VisionSource.Seat, at, Vision.MALLORCA, since, until)

/** A seat at Stockholm, and a vision of Helsinki that lasted from ten days ago until yesterday. */
private val seatAndAnEndedVision = listOf(
    point(stockholm),
    point(helsinki, since = WorldTime(today.day - 10), until = WorldTime(today.day - 1)),
)

/** Decision record 0061's table of what each level of the fog lets through, asked of `Fog` directly. */
class FogSpec : StringSpec({

    "a house is seen on ground its house has revealed, in vision or not, and not on unknown ground" {
        val fog = Fog(me, seatAndAnEndedVision)

        fog.letsThrough(house(them, nearby)) shouldBe true
        fog.letsThrough(house(them, helsinki)) shouldBe true
        fog.letsThrough(house(them, paris)) shouldBe false
    }

    "somebody is seen only in vision, so not on ground revealed and no longer watched" {
        val fog = Fog(me, seatAndAnEndedVision)

        fog.letsThrough(person(), standing(nearby), today) shouldBe true
        fog.letsThrough(person(), standing(helsinki), today) shouldBe false
        // Looking back at a day the vision lasted, they were in it.
        fog.letsThrough(person(), standing(helsinki), WorldTime(today.day - 5)) shouldBe true
    }

    "anything of significance 80 or more is seen through the fog from anywhere" {
        val fog = Fog(me, seatAndAnEndedVision)

        fog.letsThrough(house(them, paris, significance = 80.0)) shouldBe true
        fog.letsThrough(house(them, paris, significance = 79.9)) shouldBe false
        fog.letsThrough(person(), standing(paris, significance = 80.0), today) shouldBe true
    }

    "a player's own house and own key figures are always theirs, whatever the sight says" {
        val fog = Fog(me, emptyList())

        fog.letsThrough(house(me, paris)) shouldBe true
        fog.letsThrough(person(heldBy = me), standing(paris), today) shouldBe true
        fog.letsThrough(person(heldBy = them), standing(paris), today) shouldBe false
    }

    "a connection that has not said who it is sees only the really big" {
        Fog.NOBODY.letsThrough(house(them, stockholm)) shouldBe false
        Fog.NOBODY.letsThrough(house(them, stockholm, significance = 90.0)) shouldBe true
    }
})
