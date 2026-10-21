package villages.app

import org.springframework.context.annotation.Configuration
import org.springframework.http.server.ServerHttpRequest
import org.springframework.http.server.ServerHttpResponse
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.WebSocketHandler
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.config.annotation.EnableWebSocket
import org.springframework.web.socket.config.annotation.WebSocketConfigurer
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry
import org.springframework.web.socket.handler.TextWebSocketHandler
import org.springframework.web.socket.server.HandshakeInterceptor
import villages.application.SignInId
import villages.application.SignedIn
import villages.application.SignedInPlayers
import villages.gateway.Gateway
import villages.protocol.ProtocolJson
import villages.protocol.ServerFrame
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.locks.Lock
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/**
 * The gateway on a WebSocket at /ws. A page served from this machine may connect from whichever port it is
 * on: the main checkout's dev server is on 5173 and every worktree's is on a port of its own, see decision
 * 0031. Any port, but only localhost: `*` would let any site a browser here visits open a socket to the game
 * server. GatewayOriginTest holds both halves.
 *
 * Who the socket plays as is read off its handshake, which carries the browser's sign-in cookie: see
 * [SignedInAtTheHandshake].
 */
@Configuration
@EnableWebSocket
class WebSocketConfig(
    private val socket: GatewaySocket,
    private val signedIn: SignedInPlayers,
    private val cookie: SignInCookie,
) : WebSocketConfigurer {
    override fun registerWebSocketHandlers(registry: WebSocketHandlerRegistry) {
        registry.addHandler(socket, "/ws")
            .addInterceptors(SignedInAtTheHandshake(signedIn, cookie))
            .setAllowedOriginPatterns(OUR_PAGES)
    }
}

/**
 * Who the browser opening a socket is signed in as, read off the handshake's cookie and kept on the session for the
 * gateway's connection: the one place a player comes from, because the page holds no secret it could send in hello.
 * A handshake signed in to nobody still opens, for the pages that only watch; its hello is refused. See decision
 * record 0111.
 */
internal class SignedInAtTheHandshake(private val signedIn: SignedInPlayers, private val cookie: SignInCookie) : HandshakeInterceptor {
    override fun beforeHandshake(
        request: ServerHttpRequest,
        response: ServerHttpResponse,
        handler: WebSocketHandler,
        attributes: MutableMap<String, Any>,
    ): Boolean {
        cookie.read(request.headers)?.let(signedIn::signedIn)?.let { attributes[SIGNED_IN] = it }
        return true
    }

    override fun afterHandshake(request: ServerHttpRequest, response: ServerHttpResponse, handler: WebSocketHandler, failed: Exception?) =
        Unit
}

/**
 * The transport, and only the transport: one gateway connection per socket, text in, text out. Sends are
 * synchronised per session because Spring's sessions do not allow concurrent sends and the event feed
 * arrives on its own thread.
 *
 * A message comes in pieces as large as the socket's buffer, the container's default eight kilobytes, and is
 * gathered here only while it is arriving: an inspect page saving a catalogue whole sends more than that (decision
 * record 0097), and a buffer as large as the largest message, given to every socket as it opens, cost every
 * player four megabytes and one server three quarters of the players it could carry (experiment 0021). A message
 * past [LARGEST_MESSAGE] closes its connection, as a socket's own limit did.
 */
class GatewaySocket(private val gateway: Gateway) : TextWebSocketHandler() {
    private val connections = ConcurrentHashMap<String, Gateway.Connection>()
    private val gathering = ConcurrentHashMap<String, StringBuilder>()

    /** The sign-in each open socket was signed in by, which the sweep keeps alive while its window is open. */
    private val signedIn = ConcurrentHashMap<String, SignedIn>()

    /** Every sign-in with a window open now. */
    fun signInsInUse(): Set<SignInId> = signedIn.values.mapTo(HashSet()) { it.signIn }

    override fun supportsPartialMessages(): Boolean = true

    override fun afterConnectionEstablished(session: WebSocketSession) {
        session.attributes[SENDING] = ReentrantLock()
        val by = session.attributes[SIGNED_IN] as? SignedIn
        by?.let { signedIn[session.id] = it }
        connections[session.id] = gateway.connect(by) { frame -> session.sendUnlessGoing(frame) }
    }

    override fun handleTextMessage(session: WebSocketSession, message: TextMessage) {
        val begun = gathering[session.id]
        if (begun == null && message.isLast) {
            connections[session.id]?.receive(message.payload)
            return
        }
        val so = (begun ?: StringBuilder().also { gathering[session.id] = it }).append(message.payload)
        if (so.length > LARGEST_MESSAGE) {
            gathering.remove(session.id)
            session.close(CloseStatus.TOO_BIG_TO_PROCESS)
            return
        }
        if (message.isLast) {
            gathering.remove(session.id)
            connections[session.id]?.receive(so.toString())
        }
    }

    override fun afterConnectionClosed(session: WebSocketSession, status: CloseStatus) {
        gathering.remove(session.id)
        signedIn.remove(session.id)
        connections.remove(session.id)?.disconnected()
    }

    companion object {
        /** The largest message a connection may send: a catalogue saved whole from its page, with room to grow. */
        const val LARGEST_MESSAGE = 1 shl 20
    }
}

/**
 * Sends a frame, or drops it when the socket is going. Open is not enough to go on: Tomcat's session says
 * it is open while it is closing, and from the close frame going out until `afterConnectionClosed` has run,
 * a send throws. A seeding connection closes the moment its command is accepted, which is exactly then.
 */
internal fun WebSocketSession.sendUnlessGoing(frame: ServerFrame) {
    val message = TextMessage(ProtocolJson.encode(frame))
    // A lock a virtual thread would park on, where `synchronized` pins the thread it runs on for the length of a slow
    // send (JDK 21): ready for sends on virtual threads (experiment 0023). A session made without one, a test's, is
    // locked on itself as before.
    val lock = attributes[SENDING] as? Lock
    if (lock == null) synchronized(this) { send(message) } else lock.withLock { send(message) }
}

private fun WebSocketSession.send(message: TextMessage) {
    if (!isOpen) {
        return
    }
    try {
        sendMessage(message)
    } catch (@Suppress("SwallowedException") closed: IllegalStateException) {
        // Not delivered: the session was closed under the send.
    } catch (@Suppress("SwallowedException") broken: IOException) {
        // Not delivered: the connection failed, and Tomcat closes the session behind it.
    }
}

/** The attribute a session's sending lock is kept under. */
private const val SENDING = "villages.sending"

/** The attribute who a session is signed in as is kept under, by [SignedInAtTheHandshake]. */
private const val SIGNED_IN = "villages.signedIn"
