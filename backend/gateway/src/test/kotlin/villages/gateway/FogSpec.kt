package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import villages.application.CharacterRow
import villages.application.CharacterSpan
import villages.application.Holder
import villages.application.HouseRow
import villages.application.VisionPoint
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

private val stockholm = Location(59.33, 18.07)
/** A kilometre or so from the seat at Stockholm, well inside its 34. */
private val nearby = Location(59.34, 18.06)
/** Four hundred kilometres off: a vision given here and taken away leaves it revealed. */
private val helsinki = Location(60.17, 24.94)
/** Nowhere the house has ever seen. */
private val paris = Location(48.85, 2.35)

/** A hundred kilometres east of Stockholm on the map, so a gap of 32 km between two seat-sized circles. */
private val eastOfStockholm = Location(59.33, 19.83)
/** Halfway between the two: fifty kilometres from each, outside both circles and inside the bridge. */
private val betweenThem = Location(59.33, 18.95)

private val banner = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT)

private fun house(of: PlayerId, at: Location, significance: Double = 20.0, since: WorldTime = today) = HouseRow(
    id = HouseId.of(of),
    player = of,
    name = HouseName.of("Kestrel"),
    seat = at,
    significance = Significance(significance),
    banner = banner,
    resources = emptyMap(),
    pledges = emptyList(),
    since = since,
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
    VisionPoint(A_CASTLES_SIGHT, at, Vision.MALLORCA, since, until)

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

    "ground between two circles close together is seen too, because the edge of sight has surface tension" {
        val fog = Fog(me, listOf(point(stockholm), point(eastOfStockholm)))

        fog.letsThrough(house(them, betweenThem)) shouldBe true
        fog.letsThrough(person(), standing(betweenThem), today) shouldBe true
        Fog(me, listOf(point(stockholm), point(eastOfStockholm)), tension = 0.0)
            .letsThrough(house(them, betweenThem)) shouldBe false
    }

    "a bridge to a point that has ended is revealed, and is not in vision" {
        val ended = point(eastOfStockholm, since = WorldTime(today.day - 10), until = WorldTime(today.day - 1))
        val fog = Fog(me, listOf(point(stockholm), ended))

        fog.letsThrough(house(them, betweenThem)) shouldBe true
        fog.letsThrough(person(), standing(betweenThem), today) shouldBe false
    }

    "a house in vision, its own, or one seen from anywhere has no day the fog hid it: it is as it is now" {
        val fog = Fog(me, seatAndAnEndedVision)

        fog.hidOn(house(them, nearby), today) shouldBe null
        fog.hidOn(house(me, paris), today) shouldBe null
        fog.hidOn(house(them, paris, significance = 80.0), today) shouldBe null
    }

    // The Helsinki vision lasted until yesterday, so yesterday is the day the fog came back over it.
    "a house on ground revealed and no longer in vision was hidden on the day that vision ended" {
        val fog = Fog(me, seatAndAnEndedVision)

        fog.hidOn(house(them, helsinki), today) shouldBe WorldTime(today.day - 1)
        // Looking back at a day the vision lasted, it was in it.
        fog.hidOn(house(them, helsinki), WorldTime(today.day - 5)) shouldBe null
    }

    // As the ground was when the fog hid it, yesterday: a house there by then is sent, dated, and one founded since is
    // not. Founded the very day, it counts as there, as everything within one day does.
    "a house on ground the fog has hidden is sent as it was then, so not at all if it was founded since" {
        val fog = Fog(me, seatAndAnEndedVision)
        val before = house(them, helsinki, since = WorldTime(today.day - 3))
        val thatDay = house(them, helsinki, since = WorldTime(today.day - 1))

        fog.sent(before, today, before.toView())?.seenUntil shouldBe today.day - 1
        fog.sent(thatDay, today, thatDay.toView())?.seenUntil shouldBe today.day - 1
        fog.sent(house(them, helsinki), today, house(them, helsinki).toView()) shouldBe null
        // What it sees, and what is its own, are as they are, whenever they were founded.
        fog.sent(house(them, nearby), today, house(them, nearby).toView()) shouldBe house(them, nearby).toView()
        fog.sent(house(me, paris), today, house(me, paris).toView()) shouldBe house(me, paris).toView()
        fog.sent(house(them, paris), today, house(them, paris).toView()) shouldBe null
    }

    "a vision begun and ended within one day saw a house that day, and the fog hid it the same day" {
        val passing = point(helsinki, since = WorldTime(today.day - 5), until = WorldTime(today.day - 5))

        Fog(me, listOf(point(stockholm), passing)).hidOn(house(them, helsinki), today) shouldBe WorldTime(today.day - 5)
    }

    // Stockholm's vision ended the day the one east of it began, so no one day saw both, or the ground between them.
    "a house on ground only the tension between two days' points revealed was hidden on the day it was revealed" {
        val before = point(stockholm, since = WorldTime(today.day - 10), until = WorldTime(today.day - 4))
        val after = point(eastOfStockholm, since = WorldTime(today.day - 4))
        val fog = Fog(me, listOf(before, after))

        fog.letsThrough(house(them, betweenThem)) shouldBe true
        fog.hidOn(house(them, betweenThem), today) shouldBe WorldTime(today.day - 4)
    }

    "a connection that has not said who it is sees only the really big" {
        Fog.NOBODY.letsThrough(house(them, stockholm)) shouldBe false
        Fog.NOBODY.letsThrough(house(them, stockholm, significance = 90.0)) shouldBe true
    }

    "a stand goes where it touches revealed ground or comes within the scatter's margin of it, and nowhere else" {
        val fog = Fog(me, listOf(point(stockholm)))
        val x = worldX(stockholm.lon)
        val y = worldY(stockholm.lat)
        // The seat's 34 km is 54.5 world units at Stockholm's latitude.

        fog.letsThrough(x, y, 6.0) shouldBe true
        // Sixty units east is five and a half outside the circle: a reach of two and the margin cover it.
        fog.letsThrough(x + 60.0, y, 2.0) shouldBe true
        fog.letsThrough(x + 60.0, y, 0.0) shouldBe true
        // Seventy is fifteen and a half outside, past a reach of two and the margin's eight.
        fog.letsThrough(x + 70.0, y, 2.0) shouldBe false
        fog.letsThrough(x + 70.0, y, 8.0) shouldBe true
        fog.letsThrough(x + 100.0, y, 6.0) shouldBe false
    }

    "a house that has seen nowhere is sent no stands, not even over its own seat" {
        Fog.NOBODY.letsThrough(worldX(stockholm.lon), worldY(stockholm.lat), 6.0) shouldBe false
        Fog(me, emptyList()).letsThrough(worldX(stockholm.lon), worldY(stockholm.lat), 6.0) shouldBe false
    }
})

/** How far across the scenery's world a place is, in world units: the Mercator square, 32768 a side. */
private fun worldX(lon: Double): Double = (lon + 180.0) / 360.0 * 32768.0

/** How far down the scenery's world a place is, in world units. */
private fun worldY(lat: Double): Double =
    (0.5 - kotlin.math.ln(kotlin.math.tan(kotlin.math.PI / 4.0 + lat * kotlin.math.PI / 360.0)) / (2.0 * kotlin.math.PI)) * 32768.0
