package villages.bots

import java.net.URI
import java.net.http.HttpClient
import java.net.http.WebSocket
import java.util.concurrent.CompletableFuture
import java.util.concurrent.CompletionStage
import java.util.concurrent.TimeUnit

/** What a bot says through: one text frame at a time. A test stands a list in for it. */
interface Wire {
    fun send(text: String)

    fun close()
}

/**
 * A wire over the JDK's own WebSocket client, so the swarm needs nothing but the protocol. One `HttpClient` is shared
 * by every bot of a run, which keeps every socket on one selector rather than a thread each. The server allows pages
 * from localhost only, so the bot says it is one.
 */
class JdkWire private constructor(private val socket: WebSocket) : Wire {
    // The JDK refuses a second send while the first is still going out; chained, a bot's frames leave in order.
    private var sending: CompletableFuture<WebSocket> = CompletableFuture.completedFuture(socket)

    @Synchronized
    override fun send(text: String) {
        sending = sending.thenCompose { it.sendText(text, true) }
    }

    override fun close() {
        socket.sendClose(WebSocket.NORMAL_CLOSURE, "done").orTimeout(2, TimeUnit.SECONDS).exceptionally { null }
    }

    companion object {
        /** Opens a socket to `uri`, handing each whole text frame to `heard` and the end of the socket to `ended`. */
        fun open(client: HttpClient, uri: URI, heard: (String) -> Unit, ended: (String) -> Unit): CompletableFuture<Wire> =
            client.newWebSocketBuilder()
                .header("Origin", "http://localhost")
                .buildAsync(uri, Listening(heard, ended))
                .thenApply(::JdkWire)
    }

    /** A frame may come in pieces; it is handed on whole. */
    private class Listening(private val heard: (String) -> Unit, private val ended: (String) -> Unit) : WebSocket.Listener {
        private val gathering = StringBuilder()

        override fun onText(socket: WebSocket, data: CharSequence, last: Boolean): CompletionStage<*>? {
            gathering.append(data)
            if (last) {
                val whole = gathering.toString()
                gathering.setLength(0)
                heard(whole)
            }
            socket.request(1)
            return null
        }

        override fun onClose(socket: WebSocket, statusCode: Int, reason: String): CompletionStage<*>? {
            ended("closed by the server, $statusCode $reason")
            return null
        }

        override fun onError(socket: WebSocket, error: Throwable) {
            ended("${error.javaClass.simpleName}: ${error.message}")
        }
    }
}
