package villages.accounts

import java.time.Instant

/**
 * The words of every mail the accounts send, in one place, so they can be read together and changed without hunting:
 * what a person reads in their inbox. Plain text, short, and saying what to do. See docs/plans/accounts.md.
 */
object Letters {
    /** To an account's email, with the link that verifies it. */
    fun verify(to: String, link: String, at: Instant) = Mail(
        to = to,
        subject = "Verify your Villages email",
        text = """
            |This address was given to a Villages account. Open the link to say that it is yours:
            |
            |$link
            |
            |It works once, for a day. If you did not make an account, nothing will happen if you leave this be.
        """.trimMargin(),
        link = link,
        sent = at,
    )

    /** To an account's email, with the link that chooses a new password. */
    fun reset(to: String, link: String, at: Instant) = Mail(
        to = to,
        subject = "Choose a new Villages password",
        text = """
            |Somebody, perhaps you, asked to choose a new password for the Villages account of this address. Open the link
            |to choose one:
            |
            |$link
            |
            |It works once, for an hour, and choosing a new password signs out every browser signed in to the account.
            |If it was not you, nothing has changed, and the password is what it was.
        """.trimMargin(),
        link = link,
        sent = at,
    )

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
