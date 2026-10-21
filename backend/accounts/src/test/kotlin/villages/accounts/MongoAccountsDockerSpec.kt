package villages.accounts

import io.kotest.core.spec.style.StringSpec
import io.kotest.core.test.Enabled
import io.kotest.core.test.TestCase
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import org.testcontainers.DockerClientFactory
import org.testcontainers.mongodb.MongoDBContainer
import villages.domain.PlayerId
import java.time.Duration
import java.util.UUID

/**
 * The accounts kept in MongoDB, against a real one in a container of the spec's own: a sign-in put is read back as it
 * was, by its secret's hash and by its player, a restart forgets none of it, and a player has one record.
 *
 * It needs Docker, says so in its name, and is skipped with the reason when Docker is not running.
 */
class MongoAccountsDockerSpec : StringSpec({
    val docker = DockerClientFactory.instance().isDockerAvailable
    val needsDocker: (TestCase) -> Enabled = {
        if (docker) Enabled.enabled else Enabled.disabled("needs Docker, and Docker is not running")
    }

    // The image infra/docker-compose.yml runs, so the accounts are tested on the MongoDB the game keeps them in.
    val mongo by lazy { MongoDBContainer("mongo:8.0").withReplicaSet().also { it.start() } }

    fun stores(database: String) = MongoAccounts(mongo.connectionString, database)

    "a sign-in is read back as it was put, by its secret and by its player, after a restart".config(enabledOrReasonIf = needsDocker) {
        val clock = HandClock()
        val player = PlayerId(UUID.randomUUID())
        val begun = stores("restart").use { SignIns(it.signIns, clock).begin(player, Keeping.REMEMBERED, "Chrome on Windows") }

        stores("restart").use { again ->
            val signIns = SignIns(again.signIns, clock)
            signIns.find(begun.secret) shouldBe begun.signIn
            signIns.of(player).map { it.id } shouldContainExactly listOf(begun.signIn.id)
        }
    }

    "a used sign-in is written again, and an ended one is gone".config(enabledOrReasonIf = needsDocker) {
        val clock = HandClock()
        stores("used").use { kept ->
            val signIns = SignIns(kept.signIns, clock)
            val begun = signIns.begin(PlayerId(UUID.randomUUID()), Keeping.FOR_NOW, "Firefox on Linux")

            clock.pass(Duration.ofHours(6))
            signIns.use(signIns.find(begun.secret)!!)
            clock.pass(Duration.ofHours(11))
            signIns.find(begun.secret)?.lastUsed shouldBe begun.signIn.lastUsed + Duration.ofHours(6)

            clock.pass(Duration.ofHours(2))
            signIns.find(begun.secret).shouldBeNull()
            kept.signIns.byId(begun.signIn.id).shouldBeNull()
        }
    }

    "one account to an email, held by the store, and a guest's record holds none".config(enabledOrReasonIf = needsDocker) {
        stores("emails").use { kept ->
            val ada = PlayerRecord(PlayerId(UUID.randomUUID()), HandClock().now, email = "ada@example.com", password = "hash")
            val other = PlayerRecord(PlayerId(UUID.randomUUID()), HandClock().now, email = "ada@example.com", password = "hash")

            kept.players.claim(ada) shouldBe true
            kept.players.claim(other) shouldBe false
            kept.players.add(PlayerRecord(PlayerId(UUID.randomUUID()), HandClock().now)) shouldBe true
            kept.players.add(PlayerRecord(PlayerId(UUID.randomUUID()), HandClock().now)) shouldBe true
            kept.players.byEmail("ada@example.com") shouldBe ada
        }
    }

    "one account to a Google or a Discord identity, found by it".config(enabledOrReasonIf = needsDocker) {
        stores("logins").use { kept ->
            val google = Login("google", "1029384756")
            val ada = PlayerRecord(PlayerId(UUID.randomUUID()), HandClock().now, logins = listOf(google))
            val other = PlayerRecord(PlayerId(UUID.randomUUID()), HandClock().now, logins = listOf(google))

            kept.players.claim(ada) shouldBe true
            kept.players.claim(other) shouldBe false
            kept.players.byLogin(google) shouldBe ada
        }
    }

    "a player has one record".config(enabledOrReasonIf = needsDocker) {
        stores("players").use { kept ->
            val record = PlayerRecord(PlayerId(UUID.randomUUID()), HandClock().now)

            kept.players.add(record) shouldBe true
            kept.players.add(record) shouldBe false
            kept.players.of(record.player) shouldBe record
        }
    }
})
