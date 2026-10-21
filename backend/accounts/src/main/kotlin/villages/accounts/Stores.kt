package villages.accounts

import villages.application.SignInId
import villages.domain.PlayerId
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap

/** Where the sign-ins are kept: in memory, or in the tree's own MongoDB. Each is put whole, by its id. */
interface SignInStore {
    fun put(signIn: SignIn)

    fun byHash(hash: String): SignIn?

    fun byId(id: SignInId): SignIn?

    fun of(player: PlayerId): List<SignIn>

    /** False when there was no such sign-in. */
    fun remove(id: SignInId): Boolean
}

/**
 * Who a player is beyond the world's id for them: when they came, their own settings, and an account's way in - its
 * email, kept as [emailOf] has it, whether that has been verified, and the password's hash. Every player signed in
 * has one, a guest included, so there is one place their settings are kept; a guest's has no email.
 */
data class PlayerRecord(
    val player: PlayerId,
    val since: Instant,
    val settings: Settings = Settings(),
    val email: String? = null,
    val verified: Boolean = false,
    /** [Passwords.hash] of the account's password, never the password. */
    val password: String? = null,
) {
    /** A player without an account: no email to sign in with. */
    val guest: Boolean get() = email == null
}

/**
 * A player's settings that are not the game's, kept for the player so they follow an account to another browser:
 * whether the world moves - the clouds, the water, the creatures, the trees in the wind - as the device asks, or still,
 * or moving whatever the device asks; and the language, which is English alone until the game's words are translated.
 */
data class Settings(val motion: String = MOTIONS.first(), val language: String = LANGUAGES.first()) {
    init {
        require(motion in MOTIONS) { "motion is one of $MOTIONS, not $motion" }
        require(language in LANGUAGES) { "language is one of $LANGUAGES, not $language" }
    }

    companion object {
        val MOTIONS = listOf("device", "still", "moving")
        val LANGUAGES = listOf("en")
    }
}

/** Where the players' records are kept: in memory, or in the tree's own MongoDB. One to a player. */
interface PlayerStore {
    /** Adds [record], or does nothing and says false when its player has one already. */
    fun add(record: PlayerRecord): Boolean

    fun of(player: PlayerId): PlayerRecord?

    /** Writes [record] over the one its player has. */
    fun put(record: PlayerRecord)

    /** The account kept under [email], as [emailOf] has it. */
    fun byEmail(email: String): PlayerRecord?

    /**
     * Writes [record] over the one its player has, unless another player's account is kept under its email, and says
     * which: one account to an email, held by the store at the instant of writing, so two who ask at once cannot both
     * have it.
     */
    fun claim(record: PlayerRecord): Boolean
}

/** What a mailed link is for: verifying an email, or choosing a new password. */
enum class LinkKind { VERIFY, RESET }

/**
 * A link mailed to [email], for [player], which works once and until [ends]. The mail carries its secret; this keeps
 * only the secret's hash, as a sign-in does, so a copy of the store opens nobody's link.
 */
data class MailLink(val hash: String, val kind: LinkKind, val player: PlayerId, val email: String, val ends: Instant)

/** Where the mailed links are kept: in memory, or in the tree's own MongoDB. */
interface MailLinkStore {
    fun put(link: MailLink)

    /** The link [hash] is, taken out of the store as it is read, so it works once however many ask at once. */
    fun take(hash: String): MailLink?

    /** Every link of [kind] of [player]'s gone, so only the newest mailed works. */
    fun forget(player: PlayerId, kind: LinkKind)
}

/** The accounts' stores, together, as one thing that is opened and closed. */
interface AccountStores : AutoCloseable {
    val signIns: SignInStore
    val players: PlayerStore
    val links: MailLinkStore

    /** Where they are kept, as the debug panel says it. */
    val keptIn: String
}

/** The stores in this process's memory: what the tests use, and the app whenever the world is in memory too. */
class InMemoryAccounts : AccountStores {
    override val signIns: SignInStore = object : SignInStore {
        private val byId = ConcurrentHashMap<SignInId, SignIn>()

        override fun put(signIn: SignIn) {
            byId[signIn.id] = signIn
        }

        override fun byHash(hash: String): SignIn? = byId.values.firstOrNull { it.hash == hash }

        override fun byId(id: SignInId): SignIn? = byId[id]

        override fun of(player: PlayerId): List<SignIn> = byId.values.filter { it.player == player }

        override fun remove(id: SignInId): Boolean = byId.remove(id) != null
    }

    override val players: PlayerStore = object : PlayerStore {
        private val records = ConcurrentHashMap<PlayerId, PlayerRecord>()

        override fun add(record: PlayerRecord): Boolean = records.putIfAbsent(record.player, record) == null

        override fun of(player: PlayerId): PlayerRecord? = records[player]

        override fun put(record: PlayerRecord) {
            records[record.player] = record
        }

        override fun byEmail(email: String): PlayerRecord? = records.values.firstOrNull { it.email == email }

        @Synchronized
        override fun claim(record: PlayerRecord): Boolean {
            if (records.values.any { it.email == record.email && it.player != record.player }) return false
            records[record.player] = record
            return true
        }
    }

    override val links: MailLinkStore = object : MailLinkStore {
        private val byHash = ConcurrentHashMap<String, MailLink>()

        override fun put(link: MailLink) {
            byHash[link.hash] = link
        }

        override fun take(hash: String): MailLink? = byHash.remove(hash)

        override fun forget(player: PlayerId, kind: LinkKind) {
            byHash.values.removeIf { it.player == player && it.kind == kind }
        }
    }

    override val keptIn: String = "in memory"

    override fun close() = Unit
}
