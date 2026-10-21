package villages.accounts

import java.time.Instant

/** A mail the accounts send: to whom, about what, its words, the link in it if it has one, and when. */
data class Mail(val to: String, val subject: String, val text: String, val link: String?, val sent: Instant)

/**
 * Where the accounts' mail goes. In development, the [Outbox] the debug panel shows; mail that reaches a real inbox
 * needs a domain of our own to send from, which waits on hosting. See docs/plans/accounts.md.
 */
fun interface Mailer {
    fun send(mail: Mail)
}

/**
 * The mail sent, the newest last, as many as the debug panel has room for: in development, where every mail goes,
 * because nothing could deliver one. It holds live links, so only Adam's instruments read it.
 */
class Outbox(private val most: Int = MOST) : Mailer {
    private val sent = ArrayDeque<Mail>()

    @Synchronized
    override fun send(mail: Mail) {
        sent.addLast(mail)
        while (sent.size > most) sent.removeFirst()
    }

    @Synchronized
    fun mail(): List<Mail> = sent.toList()

    private companion object {
        const val MOST = 50
    }
}
