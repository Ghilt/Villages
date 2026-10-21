package villages.accounts

import com.mongodb.ErrorCategory
import com.mongodb.MongoWriteException
import com.mongodb.client.MongoClient
import com.mongodb.client.MongoClients
import com.mongodb.client.MongoCollection
import com.mongodb.client.model.Filters.eq
import com.mongodb.client.model.IndexOptions
import com.mongodb.client.model.Indexes
import com.mongodb.client.model.ReplaceOptions
import org.bson.Document
import villages.application.SignInId
import villages.domain.PlayerId
import java.util.Date
import java.util.UUID

/**
 * The stores in the tree's own MongoDB, in the database its world is kept in, so a sign-in outlasts a restart of the
 * game server as the world does (decision record 0092). Two collections beside the events, never among them:
 * `signIns`, found by the hash of their secret, and `players`, one to a player. Ids are kept as text, so nothing
 * depends on how a driver encodes a UUID.
 */
class MongoAccounts(connection: String, val database: String) : AccountStores {
    private val client: MongoClient = MongoClients.create(connection)

    private val signInRows: MongoCollection<Document> = client.getDatabase(database).getCollection(SIGN_INS).also {
        it.createIndex(Indexes.ascending("hash"), IndexOptions().unique(true))
        it.createIndex(Indexes.ascending("player"))
    }

    private val playerRows: MongoCollection<Document> = client.getDatabase(database).getCollection(PLAYERS)

    override val signIns: SignInStore = object : SignInStore {
        override fun put(signIn: SignIn) {
            signInRows.replaceOne(eq("_id", signIn.id.value.toString()), signIn.row(), ReplaceOptions().upsert(true))
        }

        override fun byHash(hash: String): SignIn? = signInRows.find(eq("hash", hash)).first()?.signIn()

        override fun byId(id: SignInId): SignIn? = signInRows.find(eq("_id", id.value.toString())).first()?.signIn()

        override fun of(player: PlayerId): List<SignIn> =
            signInRows.find(eq("player", player.value.toString())).map { it.signIn() }.toList()

        override fun remove(id: SignInId): Boolean = signInRows.deleteOne(eq("_id", id.value.toString())).deletedCount > 0
    }

    override val players: PlayerStore = object : PlayerStore {
        override fun add(record: PlayerRecord): Boolean =
            try {
                playerRows.insertOne(record.row())
                true
            } catch (taken: MongoWriteException) {
                if (taken.error.category != ErrorCategory.DUPLICATE_KEY) throw taken
                false
            }

        override fun of(player: PlayerId): PlayerRecord? = playerRows.find(eq("_id", player.value.toString())).first()?.player()
    }

    override val keptIn: String = "in MongoDB, database $database"

    override fun close() = client.close()

    private companion object {
        const val SIGN_INS = "signIns"
        const val PLAYERS = "players"
    }
}

private fun SignIn.row() = Document()
    .append("_id", id.value.toString())
    .append("hash", hash)
    .append("player", player.value.toString())
    .append("keeping", keeping.name)
    .append("browser", browser)
    .append("started", Date.from(started))
    .append("lastUsed", Date.from(lastUsed))
    .append("cookieGiven", Date.from(cookieGiven))

private fun Document.signIn() = SignIn(
    id = SignInId(UUID.fromString(getString("_id"))),
    hash = getString("hash"),
    player = PlayerId(UUID.fromString(getString("player"))),
    keeping = Keeping.valueOf(getString("keeping")),
    browser = getString("browser"),
    started = getDate("started").toInstant(),
    lastUsed = getDate("lastUsed").toInstant(),
    cookieGiven = getDate("cookieGiven").toInstant(),
)

private fun PlayerRecord.row() = Document()
    .append("_id", player.value.toString())
    .append("since", Date.from(since))

private fun Document.player() = PlayerRecord(
    player = PlayerId(UUID.fromString(getString("_id"))),
    since = getDate("since").toInstant(),
)
