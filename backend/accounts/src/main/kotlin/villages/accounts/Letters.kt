package villages.accounts

import java.time.Instant

/**
 * The words of every mail the accounts send, in one place, so they can be read together and changed without hunting:
 * what a person reads in their inbox. Plain text, short, and saying what to do. See docs/plans/accounts.md.
 */
object Letters {
    /** To an address somebody tried to make an account with, when it has one already. */
    fun alreadyAnAccount(to: String, at: Instant) = Mail(
        to = to,
        subject = "You already have a Villages account",
        text = """
            |Somebody, perhaps you, tried to make a Villages account with this address, and it has one already.
            |
            |If it was you, sign in with it instead. If you have forgotten its password, the sign-in has a way to
            |choose a new one.
            |
            |If it was not you, nothing has changed and there is nothing to do.
        """.trimMargin(),
        link = null,
        sent = at,
    )
}
