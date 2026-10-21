package villages.accounts

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
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
