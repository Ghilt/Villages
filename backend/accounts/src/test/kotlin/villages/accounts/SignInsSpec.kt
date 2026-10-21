package villages.accounts

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.string.shouldNotContain
import villages.domain.PlayerId
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import java.util.UUID

/** A clock the spec moves by hand, so a sign-in's sixty days pass in a line. */
class HandClock(var now: Instant = Instant.parse("2026-10-21T12:00:00Z")) : Clock() {
    override fun instant(): Instant = now

    override fun getZone(): ZoneId = ZoneOffset.UTC

    override fun withZone(zone: ZoneId): Clock = this

    fun pass(time: Duration) {
        now += time
    }
}

/**
 * How long a sign-in lasts, which is what remember me working properly comes down to on the server: each keeping lasts
 * its time after the last use and no longer, a use moves the end on, the secret is found only by the browser that
 * holds it, and a sign-in found ended is gone.
 */
class SignInsSpec : StringSpec({
    val player = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))

    fun signIns(clock: HandClock = HandClock()) = InMemoryAccounts().let { SignIns(it.signIns, clock) to it.signIns }

    "a sign-in is found by the secret its cookie holds, and the store keeps only the secret's hash" {
        val (signIns, store) = signIns()
        val begun = signIns.begin(player, Keeping.REMEMBERED, "Chrome on Windows")

        signIns.find(begun.secret)?.player shouldBe player
        store.byId(begun.signIn.id)!!.hash shouldNotBe begun.secret
        store.byId(begun.signIn.id)!!.toString() shouldNotContain begun.secret
        signIns.find(begun.signIn.hash).shouldBeNull()
        signIns.find("not a secret anybody was given").shouldBeNull()
    }

    "remembered, it lasts sixty days after it was last used, and not a minute more" {
        val clock = HandClock()
        val (signIns, _) = signIns(clock)
        val begun = signIns.begin(player, Keeping.REMEMBERED, "Chrome on Windows")

        clock.pass(Duration.ofDays(60).minusMinutes(1))
        signIns.find(begun.secret).shouldNotBeNull()
        clock.pass(Duration.ofMinutes(1))
        signIns.find(begun.secret).shouldBeNull()
    }

    "not remembered, it ends after twelve hours unused" {
        val clock = HandClock()
        val (signIns, _) = signIns(clock)
        val begun = signIns.begin(player, Keeping.FOR_NOW, "Firefox on Linux")

        clock.pass(Duration.ofHours(12).minusSeconds(1))
        signIns.find(begun.secret).shouldNotBeNull()
        clock.pass(Duration.ofSeconds(1))
        signIns.find(begun.secret).shouldBeNull()
    }

    "a guest's lasts four hundred days, the most a browser keeps a cookie" {
        val clock = HandClock()
        val (signIns, _) = signIns(clock)
        val begun = signIns.begin(player, Keeping.GUEST, "Safari on an iPhone")

        clock.pass(Duration.ofDays(399))
        signIns.find(begun.secret).shouldNotBeNull()
        clock.pass(Duration.ofDays(1))
        signIns.find(begun.secret).shouldBeNull()
    }

    "a use moves its end on, so one used every month never ends" {
        val clock = HandClock()
        val (signIns, _) = signIns(clock)
        val begun = signIns.begin(player, Keeping.REMEMBERED, "Chrome on Windows")

        repeat(12) {
            clock.pass(Duration.ofDays(30))
            signIns.use(signIns.find(begun.secret).shouldNotBeNull())
        }
        signIns.find(begun.secret)!!.ends shouldBe clock.now + Duration.ofDays(60)
    }

    "a sign-in found ended is gone for good, and its player has none left" {
        val clock = HandClock()
        val (signIns, store) = signIns(clock)
        val begun = signIns.begin(player, Keeping.FOR_NOW, "Chrome on Windows")

        clock.pass(Duration.ofDays(1))
        signIns.find(begun.secret).shouldBeNull()
        store.byId(begun.signIn.id).shouldBeNull()
        signIns.of(player).shouldBeEmpty()
    }

    "the cookie is given its lifetime again at most once a day, and never one that dies with the browser" {
        val clock = HandClock()
        val (signIns, _) = signIns(clock)
        val remembered = signIns.begin(player, Keeping.REMEMBERED, "Chrome on Windows")
        val forNow = signIns.begin(player, Keeping.FOR_NOW, "Chrome on Windows")

        clock.pass(Duration.ofHours(5))
        signIns.use(signIns.find(remembered.secret)!!, cookie = true).cookieAgain shouldBe false
        signIns.use(signIns.find(forNow.secret)!!, cookie = true).cookieAgain shouldBe false
        clock.pass(Duration.ofHours(20))
        signIns.use(signIns.find(remembered.secret)!!, cookie = true).cookieAgain shouldBe true
        signIns.use(signIns.find(remembered.secret)!!, cookie = true).cookieAgain shouldBe false
    }

    "using it never swaps its secret, so two tabs never sign each other out" {
        val clock = HandClock()
        val (signIns, _) = signIns(clock)
        val begun = signIns.begin(player, Keeping.REMEMBERED, "Chrome on Windows")

        repeat(3) {
            clock.pass(Duration.ofDays(2))
            signIns.use(signIns.find(begun.secret)!!, cookie = true)
        }
        signIns.find(begun.secret)?.hash shouldBe begun.signIn.hash
    }

    "every sign-in that ends is told, whether it is ended or found run out" {
        val clock = HandClock()
        val told = mutableListOf<villages.application.SignInId>()
        val signIns = SignIns(InMemoryAccounts().signIns, clock) { told += it }
        val ended = signIns.begin(player, Keeping.REMEMBERED, "Chrome on Windows")
        val runOut = signIns.begin(player, Keeping.FOR_NOW, "Chrome on Windows")

        signIns.end(ended.signIn.id)
        signIns.end(ended.signIn.id)
        clock.pass(Duration.ofHours(13))
        signIns.find(runOut.secret)

        told shouldBe listOf(ended.signIn.id, runOut.signIn.id)
    }

    "a browser is named as a person would name it" {
        browserOf(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36",
        ) shouldBe "Chrome on Windows"
        browserOf(
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) " +
                "Version/18.0 Mobile/15E148 Safari/604.1",
        ) shouldBe "Safari on an iPhone"
        browserOf(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 Edg/141.0",
        ) shouldBe "Edge on Windows"
        browserOf("Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0") shouldBe "Firefox on Linux"
        browserOf(null) shouldBe "a browser"
    }
})
