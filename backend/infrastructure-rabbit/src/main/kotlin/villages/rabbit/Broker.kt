package villages.rabbit

import com.rabbitmq.client.BuiltinExchangeType
import com.rabbitmq.client.Connection
import com.rabbitmq.client.ConnectionFactory
import java.io.IOException
import java.net.ConnectException
import java.net.URI
import java.net.URLDecoder
import java.net.URLEncoder
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import java.util.Base64
import java.util.concurrent.TimeoutException

/**
 * A tree's broker: RabbitMQ at [uri], its management API at [management], and the virtual host the tree keeps to,
 * named as its database is, so that two trees' messages never meet (decision records 0092 and 0094). The user in
 * [uri] is the one the stack makes, which may make virtual hosts as well as use them.
 */
class Broker(uri: String, management: String, val virtualHost: String) {
    private val factory = ConnectionFactory().apply {
        setUri(uri)
        virtualHost = this@Broker.virtualHost
        // Whoever holds a connection says what happens when it goes, inside the wipe gate where it must (0094).
        isAutomaticRecoveryEnabled = false
        connectionTimeout = ANSWER.toMillis().toInt()
    }
    private val management = management.trimEnd('/')
    private val user = URLDecoder.decode(URI(uri).userInfo?.substringBefore(':') ?: "guest", Charsets.UTF_8)
    private val password = URLDecoder.decode(URI(uri).userInfo?.substringAfter(':', "") ?: "guest", Charsets.UTF_8)

    /** Where it is, as a log line says it, without the password. */
    val where: String = "amqp://${factory.host}:${factory.port}"

    /**
     * Makes the virtual host, lets the user use it, and declares the exchange in it. Each is idempotent, so every
     * start does all three, and a tree whose virtual host was dropped has it again on its next start.
     */
    fun prepare() {
        val host = URLEncoder.encode(virtualHost, Charsets.UTF_8)
        put("/api/vhosts/$host", """{"description":"a tree's world, carried (decision record 0094)"}""")
        put("/api/permissions/$host/${URLEncoder.encode(user, Charsets.UTF_8)}", """{"configure":".*","write":".*","read":".*"}""")
        connect("villages: declaring the exchange").use { connection ->
            connection.createChannel().use { it.exchangeDeclare(EXCHANGE, BuiltinExchangeType.TOPIC, true) }
        }
    }

    /**
     * A connection of its own in the tree's virtual host, named so that the management page says whose it is. The
     * client does not recover it: whoever holds it says what happens when it goes.
     */
    fun connect(name: String): Connection = try {
        factory.newConnection(name)
    } catch (unanswered: IOException) {
        throw notAnswering(where, unanswered)
    } catch (unanswered: TimeoutException) {
        throw notAnswering(where, unanswered)
    }

    private fun put(path: String, body: String) {
        val request = HttpRequest.newBuilder(URI("$management$path"))
            .timeout(ANSWER)
            .header("Authorization", "Basic " + Base64.getEncoder().encodeToString("$user:$password".toByteArray()))
            .header("Content-Type", "application/json")
            .PUT(HttpRequest.BodyPublishers.ofString(body))
            .build()
        val answer = try {
            http.send(request, HttpResponse.BodyHandlers.ofString())
        } catch (unanswered: ConnectException) {
            throw notAnswering("its management page at $management", unanswered)
        } catch (unanswered: java.net.http.HttpTimeoutException) {
            throw notAnswering("its management page at $management", unanswered)
        }
        check(answer.statusCode() in 200..299) {
            "RabbitMQ refused PUT $path for the virtual host $virtualHost: ${answer.statusCode()} ${answer.body()}"
        }
    }

    private fun notAnswering(at: String, why: Exception) = IllegalStateException(
        "RabbitMQ did not answer at $at, so the world cannot be carried in the virtual host $virtualHost. " +
            "It runs in Docker: docker compose -f infra/docker-compose.yml up -d",
        why,
    )

    companion object {
        /** The one topic exchange every event is published to, in each tree's virtual host. */
        const val EXCHANGE = "villages.events"

        /** How long RabbitMQ has to answer before a start says it did not. */
        private val ANSWER: Duration = Duration.ofSeconds(5)

        // HTTP/1.1: asked to upgrade to HTTP/2 in the clear, RabbitMQ's management closes the connection instead.
        private val http: HttpClient =
            HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).connectTimeout(ANSWER).build()
    }
}
