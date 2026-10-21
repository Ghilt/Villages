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

        val made = accounts.makeAccount("Ada@Example.com", password, Keeping.REMEMBERED, "Chrome on Windows", guest.signIn, "here")

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
        accounts.makeAccount("ada@example.com", password, Keeping.REMEMBERED, "Chrome on Windows", null, "here")
        val other = accounts.newcomer("Firefox on Linux")

        accounts.makeAccount("ADA@example.com", "another quiet river", Keeping.REMEMBERED, "Firefox on Linux", other.signIn, "there") shouldBe
            Making.Taken
        outbox.mail().single().subject shouldBe "You already have a Villages account"
        accounts.who(other.secret)?.guest shouldBe true
    }

    "a password that will not do is refused before anything is written" {
        val accounts = accounts()
        val guest = accounts.newcomer("Chrome on Windows")

        accounts.makeAccount("ada@example.com", "too short", Keeping.REMEMBERED, "Chrome", guest.signIn, "here") shouldBe Making.Refused("short")
        accounts.makeAccount("not an email", password, Keeping.REMEMBERED, "Chrome", guest.signIn, "here") shouldBe Making.Refused("notAnEmail")
        accounts.who(guest.secret)?.guest shouldBe true
    }

    "the right password signs a browser in, leaving whatever it was before; a wrong one and a stranger are answered alike" {
        val accounts = accounts()
        val made = accounts.makeAccount("ada@example.com", password, Keeping.REMEMBERED, "Chrome", null, "here")
            .shouldBeInstanceOf<Making.Made>()
        val guest = accounts.newcomer("Firefox on Linux")

        accounts.signInWith("ada@example.com", "a long and quiet rivet", Keeping.FOR_NOW, "Firefox", guest.signIn, "there") shouldBe
            Entering.NotThatPassword
        accounts.signInWith("nobody@example.com", password, Keeping.FOR_NOW, "Firefox", guest.signIn, "there") shouldBe
            Entering.NotThatPassword
        val entered = accounts.signInWith(" Ada@example.com", password, Keeping.FOR_NOW, "Firefox", guest.signIn, "there")
            .shouldBeInstanceOf<Entering.In>()

        entered.begun.signIn.player shouldBe made.begun.signIn.player
        entered.begun.signIn.keeping shouldBe Keeping.FOR_NOW
        accounts.signedIn(guest.secret).shouldBeNull()
    }

    "five wrong passwords for one email are a quarter of an hour's wait, even with the right one" {
        val clock = HandClock()
        val accounts = accounts(clock = clock)
        accounts.makeAccount("ada@example.com", password, Keeping.REMEMBERED, "Chrome", null, "here")

        repeat(5) { accounts.signInWith("ada@example.com", "wrong guess $it", Keeping.REMEMBERED, "Chrome", null, "there") }

        accounts.signInWith("ada@example.com", password, Keeping.REMEMBERED, "Chrome", null, "there") shouldBe Entering.TooMany
        clock.pass(java.time.Duration.ofMinutes(15))
        accounts.signInWith("ada@example.com", password, Keeping.REMEMBERED, "Chrome", null, "there").shouldBeInstanceOf<Entering.In>()
    }
})
