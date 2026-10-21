package villages.accounts

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.types.shouldBeInstanceOf
import villages.domain.PlayerId
import java.util.UUID

/** A newcomer made a guest, and the socket's question of a cookie: who it is signed in as. */
class AccountsSpec : StringSpec({
    "a newcomer is a player of their own, with a guest's sign-in and a record" {
        val stores = InMemoryAccounts()
        val accounts = Accounts(stores, HandClock())

        val begun = accounts.newcomer("Chrome on Windows")

        begun.signIn.keeping shouldBe Keeping.GUEST
        stores.players.of(begun.signIn.player).shouldNotBeNull()
        accounts.who(begun.secret)?.guest shouldBe true
    }

    "two newcomers are two players" {
        val accounts = Accounts(InMemoryAccounts(), HandClock())

        accounts.newcomer("Chrome on Windows").signIn.player shouldNotBe accounts.newcomer("Chrome on Windows").signIn.player
    }

    "the socket is told the player and the sign-in, and nothing for a secret that is not one" {
        val player = PlayerId(UUID.randomUUID())
        val accounts = Accounts(InMemoryAccounts(), HandClock(), newPlayer = { player })
        val begun = accounts.newcomer("Chrome on Windows")

        val signedIn = accounts.signedIn(begun.secret).shouldNotBeNull()
        signedIn.player shouldBe player
        signedIn.signIn shouldBe begun.signIn.id
        accounts.signedIn("somebody else's guess").shouldBeNull()
    }
})

/** An account made and signed in to, with an email and a password. */
class AccountsWithPasswordsSpec : StringSpec({
    val password = "a long and quiet river"

    fun accounts(outbox: Outbox = Outbox(), clock: HandClock = HandClock()) =
        InMemoryAccounts().let { Accounts(it, clock, mailer = outbox) }

    "a guest who makes an account is that account: the same player, house and all, signed in anew" {
        val accounts = accounts()
        val guest = accounts.newcomer("Chrome on Windows")

        val made = accounts.makeAccount("Ada@Example.com", password, Keeping.REMEMBERED, guest.signIn, Asking("Chrome on Windows", "here", "http://localhost:5548"))

        made.shouldBeInstanceOf<Making.Made>().begun.signIn.player shouldBe guest.signIn.player
        made.begun.secret shouldNotBe guest.secret
        accounts.signedIn(guest.secret).shouldBeNull()
        accounts.recordOf(guest.signIn.player)?.email shouldBe "ada@example.com"
        accounts.recordOf(guest.signIn.player)?.verified shouldBe false
        accounts.who(made.begun.secret)?.guest shouldBe false
    }

    "an email with an account already is mailed to say so, and nothing else changes" {
        val outbox = Outbox()
        val accounts = accounts(outbox)
        accounts.makeAccount("ada@example.com", password, Keeping.REMEMBERED, null, Asking("Chrome on Windows", "here", "http://localhost:5548"))
        val other = accounts.newcomer("Firefox on Linux")

        accounts.makeAccount("ADA@example.com", "another quiet river", Keeping.REMEMBERED, other.signIn, Asking("Firefox on Linux", "there", "http://localhost:5548")) shouldBe
            Making.Taken
        outbox.mail().map { it.subject } shouldBe listOf("Verify your Villages email", "You already have a Villages account")
        accounts.who(other.secret)?.guest shouldBe true
    }

    "a password that will not do is refused before anything is written" {
        val accounts = accounts()
        val guest = accounts.newcomer("Chrome on Windows")

        accounts.makeAccount("ada@example.com", "too short", Keeping.REMEMBERED, guest.signIn, Asking("Chrome", "here", "http://localhost:5548")) shouldBe Making.Refused("short")
        accounts.makeAccount("not an email", password, Keeping.REMEMBERED, guest.signIn, Asking("Chrome", "here", "http://localhost:5548")) shouldBe Making.Refused("notAnEmail")
        accounts.who(guest.secret)?.guest shouldBe true
    }

    "the right password signs a browser in, leaving whatever it was before; a wrong one and a stranger are answered alike" {
        val accounts = accounts()
        val made = accounts.makeAccount("ada@example.com", password, Keeping.REMEMBERED, null, Asking("Chrome", "here", "http://localhost:5548"))
            .shouldBeInstanceOf<Making.Made>()
        val guest = accounts.newcomer("Firefox on Linux")

        accounts.signInWith("ada@example.com", "a long and quiet rivet", Keeping.FOR_NOW, guest.signIn, Asking("Firefox", "there", "http://localhost:5548")) shouldBe
            Entering.NotThatPassword
        accounts.signInWith("nobody@example.com", password, Keeping.FOR_NOW, guest.signIn, Asking("Firefox", "there", "http://localhost:5548")) shouldBe
            Entering.NotThatPassword
        val entered = accounts.signInWith(" Ada@example.com", password, Keeping.FOR_NOW, guest.signIn, Asking("Firefox", "there", "http://localhost:5548"))
            .shouldBeInstanceOf<Entering.In>()

        entered.begun.signIn.player shouldBe made.begun.signIn.player
        entered.begun.signIn.keeping shouldBe Keeping.FOR_NOW
        accounts.signedIn(guest.secret).shouldBeNull()
    }

    "five wrong passwords for one email are a quarter of an hour's wait, even with the right one" {
        val clock = HandClock()
        val accounts = accounts(clock = clock)
        accounts.makeAccount("ada@example.com", password, Keeping.REMEMBERED, null, Asking("Chrome", "here", "http://localhost:5548"))

        repeat(5) { accounts.signInWith("ada@example.com", "wrong guess $it", Keeping.REMEMBERED, null, Asking("Chrome", "there", "http://localhost:5548")) }

        accounts.signInWith("ada@example.com", password, Keeping.REMEMBERED, null, Asking("Chrome", "there", "http://localhost:5548")) shouldBe Entering.TooMany
        clock.pass(java.time.Duration.ofMinutes(15))
        accounts.signInWith("ada@example.com", password, Keeping.REMEMBERED, null, Asking("Chrome", "there", "http://localhost:5548")).shouldBeInstanceOf<Entering.In>()
    }

    "a made account is mailed a link under the page that asked, which verifies its email once, and only for a day" {
        val outbox = Outbox()
        val clock = HandClock()
        val accounts = accounts(outbox, clock)
        val made = accounts.makeAccount("ada@example.com", password, Keeping.REMEMBERED, null, Asking("Chrome", "here", "http://localhost:5548"))
            .shouldBeInstanceOf<Making.Made>()
        val link = outbox.mail().single().link!!

        link.substringBefore('#') shouldBe "http://localhost:5548/account/verify"
        accounts.verify(link.substringAfter('#')) shouldBe true
        accounts.recordOf(made.begun.signIn.player)?.verified shouldBe true
        accounts.verify(link.substringAfter('#')) shouldBe false

        val later = accounts.makeAccount("babbage@example.com", password, Keeping.REMEMBERED, null, Asking("Chrome", "here", "http://localhost:5548"))
            .shouldBeInstanceOf<Making.Made>()
        clock.pass(java.time.Duration.ofHours(24))
        accounts.verify(outbox.mail().last().link!!.substringAfter('#')) shouldBe false
        accounts.recordOf(later.begun.signIn.player)?.verified shouldBe false
    }

    "a verifying link mailed again is the only one that works, three times an hour at most" {
        val outbox = Outbox()
        val accounts = accounts(outbox)
        val made = accounts.makeAccount("ada@example.com", password, Keeping.REMEMBERED, null, Asking("Chrome", "here", "http://localhost:5548"))
            .shouldBeInstanceOf<Making.Made>()
        val first = outbox.mail().single().link!!.substringAfter('#')

        repeat(3) { accounts.mailVerifyingAgain(made.begun.signIn, Asking("Chrome", "here", "http://localhost:5548")) shouldBe true }
        accounts.mailVerifyingAgain(made.begun.signIn, Asking("Chrome", "here", "http://localhost:5548")) shouldBe false

        accounts.verify(first) shouldBe false
        accounts.verify(outbox.mail().last().link!!.substringAfter('#')) shouldBe true
    }

    "a forgotten password is chosen again through a mailed link, which signs out every browser and this one in" {
        val outbox = Outbox()
        val told = mutableListOf<villages.application.SignInId>()
        val stores = InMemoryAccounts()
        val accounts = Accounts(stores, HandClock(), ended = { told += it }, mailer = outbox)
        val here = Asking("Chrome", "here", "http://localhost:5548")
        val made = accounts.makeAccount("ada@example.com", password, Keeping.REMEMBERED, null, here).shouldBeInstanceOf<Making.Made>()

        accounts.forgot("nobody@example.com", here)
        accounts.forgot("Ada@example.com", here)
        val link = outbox.mail().last().also { it.subject shouldBe "Choose a new Villages password" }.link!!
        link.substringBefore('#') shouldBe "http://localhost:5548/account/reset"
        val secret = link.substringAfter('#')

        accounts.reset(secret, "short", Keeping.REMEMBERED, null, here) shouldBe Making.Refused("short")
        val again = accounts.reset(secret, "another quiet river", Keeping.REMEMBERED, null, here).shouldBeInstanceOf<Making.Made>()
        accounts.reset(secret, "a third quiet river", Keeping.REMEMBERED, null, here) shouldBe Making.Refused("linkUsedOrOld")

        told shouldBe listOf(made.begun.signIn.id)
        accounts.signInWith("ada@example.com", password, Keeping.REMEMBERED, null, here) shouldBe Entering.NotThatPassword
        accounts.signInWith("ada@example.com", "another quiet river", Keeping.REMEMBERED, null, here).shouldBeInstanceOf<Entering.In>()
        accounts.who(again.begun.secret).shouldNotBeNull()
    }

    "a changed password ends every other sign-in of the account and keeps this one, with a new secret" {
        val told = mutableListOf<villages.application.SignInId>()
        val accounts = Accounts(InMemoryAccounts(), HandClock(), ended = { told += it })
        val here = Asking("Chrome", "here", "http://localhost:5548")
        val made = accounts.makeAccount("ada@example.com", password, Keeping.REMEMBERED, null, here).shouldBeInstanceOf<Making.Made>()
        val elsewhere = accounts.signInWith("ada@example.com", password, Keeping.REMEMBERED, null, here).shouldBeInstanceOf<Entering.In>()

        accounts.changePassword(made.begun.signIn, "not the password", "another quiet river", here) shouldBe Making.Refused("notThatPassword")
        val changed = accounts.changePassword(made.begun.signIn, password, "another quiet river", here).shouldBeInstanceOf<Making.Made>()

        told shouldBe listOf(elsewhere.begun.signIn.id)
        accounts.who(changed.begun.secret).shouldNotBeNull()
        accounts.who(made.begun.secret).shouldBeNull()
    }
})
