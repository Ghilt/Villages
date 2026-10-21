package villages.accounts

import java.time.Clock
import java.time.Duration

/** How long a mailed link of each kind works: a day to verify an email, an hour to choose a new password. */
private val LASTS = mapOf(LinkKind.VERIFY to Duration.ofHours(24), LinkKind.RESET to Duration.ofHours(1))

/** The page a link of each kind opens, under the page's own address. */
private val PAGES = mapOf(LinkKind.VERIFY to "verify", LinkKind.RESET to "reset")

/**
 * The links the accounts mail: made for a player's email, each of a kind, working once and for so long, the newest
 * the only one of its kind that works. The secret is after the `#` of the address, so it reaches no server's log;
 * the page it opens sends it on with a press, because mail scanners open links before people do. See
 * docs/plans/accounts.md.
 */
class MailedLinks(private val store: MailLinkStore, private val clock: Clock) {
    /** A new link of [kind] to [record]'s email, opening a page under [page], the address it was asked from. */
    fun issue(kind: LinkKind, record: PlayerRecord, page: String): String {
        store.forget(record.player, kind)
        val secret = Secrets.fresh()
        store.put(MailLink(Secrets.hashOf(secret), kind, record.player, record.email!!, clock.instant() + LASTS.getValue(kind)))
        return "${page.trimEnd('/')}/account/${PAGES.getValue(kind)}#$secret"
    }

    /** The link of [kind] [secret] is, taken so it works no more, while it has not ended; null otherwise. */
    fun take(kind: LinkKind, secret: String): MailLink? =
        store.take(Secrets.hashOf(secret))?.takeIf { it.kind == kind && it.ends.isAfter(clock.instant()) }
}
