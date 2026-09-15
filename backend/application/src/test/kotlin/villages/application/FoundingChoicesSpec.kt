package villages.application

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import villages.domain.Effect
import villages.domain.PlayerId
import villages.domain.Tincture
import java.util.UUID

class FoundingChoicesSpec : StringSpec({
    val adam = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    val somebodyElse = PlayerId(UUID.fromString("dc58398d-7f84-46e0-b1f4-cf70803a43f9"))

    "a player is offered three seats, in three different parts of the world" {
        val choice = FoundingChoices.forPlayer(adam)

        choice.options shouldHaveSize FoundingChoices.OFFERED
        val regions = choice.options.map { it.label.substringAfter(", in ") }
        regions.distinct() shouldHaveSize FoundingChoices.OFFERED
    }

    "every option is a destiny of its own: a place, a name and a banner" {
        val choice = FoundingChoices.forPlayer(adam)

        for (option in choice.options) {
            val founding = option.effect.shouldBeInstanceOf<Effect.FoundAt>()
            option.label.isNotBlank() shouldBe true
            option.detail.contains(founding.name.value) shouldBe true
            // The rule of tincture: a charge of a metal on a field of a colour, and the reverse. The
            // banner's own constructor enforces it, so building one at all is the assertion.
            (founding.banner.field.isMetal != founding.banner.chargeTincture.isMetal) shouldBe true
        }
    }

    "the same player is offered the same three, however often they are asked" {
        FoundingChoices.forPlayer(adam) shouldBe FoundingChoices.forPlayer(adam)
    }

    "and a different player is offered something else" {
        val mine = FoundingChoices.forPlayer(adam)
        val theirs = FoundingChoices.forPlayer(somebodyElse)

        (mine.id == theirs.id) shouldBe false
        (mine.options.map { it.label } == theirs.options.map { it.label }) shouldBe false
    }

    "two players offered the same place do not found on the same spot" {
        // Enough players that some pair is bound to be offered one place in common.
        val seats = (1..60)
            .map { FoundingChoices.forPlayer(PlayerId(UUID.nameUUIDFromBytes("player-$it".toByteArray()))) }
            .flatMap { choice -> choice.options.map { it.effect.shouldBeInstanceOf<Effect.FoundAt>().seat } }

        seats.distinct() shouldHaveSize seats.size
    }

    "every seat offered is one the gazetteer holds, give or take the wobble" {
        val places = Gazetteer.seats.associateBy { "${it.place}, in ${it.region}" }

        for (option in FoundingChoices.forPlayer(adam).options) {
            val named = places.getValue(option.label)
            val seat = option.effect.shouldBeInstanceOf<Effect.FoundAt>().seat

            (kotlin.math.abs(seat.lat - named.where.lat) < 1.0) shouldBe true
            (kotlin.math.abs(seat.lon - named.where.lon) < 1.0) shouldBe true
        }
    }

    "the gazetteer has more regions than a choice offers, so three different ones can always be drawn" {
        Gazetteer.regions.size shouldBe 6
        Gazetteer.seats.map { it.region }.distinct() shouldContainExactly Gazetteer.regions
    }

    "and every seat in it is named, placed and described" {
        for (seat in Gazetteer.seats) {
            seat.place.isNotBlank() shouldBe true
            seat.region.isNotBlank() shouldBe true
            seat.detail.isNotBlank() shouldBe true
        }
    }

    "a metal is a metal and a colour is not, which is what the rule of tincture rests on" {
        Tincture.OR.isMetal shouldBe true
        Tincture.SABLE.isMetal shouldBe false
    }
})
