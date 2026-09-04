package villages.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.property.Arb
import io.kotest.property.arbitrary.enum
import io.kotest.property.arbitrary.orNull
import io.kotest.property.checkAll

class BannerSpec : StringSpec({

    "a colour charge lies on a metal field, and a metal charge on a colour field" {
        Banner(Tincture.OR, Division.PLAIN, null, Charge.STAG, Tincture.GULES).charge shouldBe Charge.STAG
        Banner(Tincture.AZURE, Division.PLAIN, null, Charge.TOWER, Tincture.ARGENT).field shouldBe Tincture.AZURE
    }

    "metal on metal and colour on colour are not banners" {
        shouldThrow<HouseError.InvalidBanner> { Banner(Tincture.OR, Division.PLAIN, null, Charge.STAR, Tincture.ARGENT) }
        shouldThrow<HouseError.InvalidBanner> { Banner(Tincture.GULES, Division.PLAIN, null, Charge.STAR, Tincture.VERT) }
    }

    "a divided field has two different tinctures and a plain one has one" {
        Banner(Tincture.GULES, Division.PER_PALE, Tincture.AZURE, Charge.STAR, Tincture.OR).second shouldBe Tincture.AZURE
        shouldThrow<HouseError.InvalidBanner> { Banner(Tincture.GULES, Division.PER_FESS, null, Charge.STAR, Tincture.OR) }
        shouldThrow<HouseError.InvalidBanner> { Banner(Tincture.GULES, Division.PLAIN, Tincture.AZURE, Charge.STAR, Tincture.OR) }
        shouldThrow<HouseError.InvalidBanner> { Banner(Tincture.GULES, Division.QUARTERLY, Tincture.GULES, Charge.STAR, Tincture.OR) }
    }

    "every banner that exists obeys the rules, and every one that breaks them does not" {
        // The property form: over every combination, construction succeeds exactly when the rules hold, so
        // there is no banner in the world a herald would refuse.
        checkAll(
            Arb.enum<Tincture>(),
            Arb.enum<Division>(),
            Arb.enum<Tincture>().orNull(),
            Arb.enum<Charge>(),
            Arb.enum<Tincture>(),
        ) { field, division, second, charge, chargeTincture ->
            val lawful = chargeTincture.contrastsWith(field) &&
                (if (division.isDivided) second != null && second != field else second == null)
            runCatching { Banner(field, division, second, charge, chargeTincture) }.isSuccess shouldBe lawful
        }
    }
})
