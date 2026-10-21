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
 * Who a player is beyond the world's id for them: a guest's record, and in time an account's way in and the player's
 * own settings. Every player signed in has one, a guest included, so there is one place their settings are kept.
 */
data class PlayerRecord(val player: PlayerId, val since: Instant)

/** Where the players' records are kept: in memory, or in the tree's own MongoDB. One to a player. */
interface PlayerStore {
    /** Adds [record], or does nothing and says false when its player has one already. */
    fun add(record: PlayerRecord): Boolean

    fun of(player: PlayerId): PlayerRecord?
}

/** The accounts' stores, together, as one thing that is opened and closed. */
interface AccountStores : AutoCloseable {
    val signIns: SignInStore
    val players: PlayerStore

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
    }

    override val keptIn: String = "in memory"

    override fun close() = Unit
}
