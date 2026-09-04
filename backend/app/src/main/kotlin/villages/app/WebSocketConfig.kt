package villages.app

import org.springframework.context.annotation.Configuration
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.config.annotation.EnableWebSocket
import org.springframework.web.socket.config.annotation.WebSocketConfigurer
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry
import org.springframework.web.socket.handler.TextWebSocketHandler
import villages.gateway.Gateway
import villages.protocol.ProtocolJson
import java.util.concurrent.ConcurrentHashMap

/** The gateway on a WebSocket at /ws. The browser's dev server is the one origin allowed, for now. */
@Configuration
@EnableWebSocket
class WebSocketConfig(private val gateway: Gateway) : WebSocketConfigurer {
    override fun registerWebSocketHandlers(registry: WebSocketHandlerRegistry) {
        registry.addHandler(GatewaySocket(gateway), "/ws").setAllowedOrigins("http://localhost:5173")
    }
}

/**
 * The transport, and only the transport: one gateway connection per socket, text in, text out. Sends are
 * synchronised per session because Spring's sessions do not allow concurrent sends and the event feed
 * arrives on its own thread.
 */
class GatewaySocket(private val gateway: Gateway) : TextWebSocketHandler() {
    private val connections = ConcurrentHashMap<String, Gateway.Connection>()

    override fun afterConnectionEstablished(session: WebSocketSession) {
        connections[session.id] = gateway.connect { frame ->
            if (session.isOpen) {
                synchronized(session) { session.sendMessage(TextMessage(ProtocolJson.encode(frame))) }
            }
        }
    }

    override fun handleTextMessage(session: WebSocketSession, message: TextMessage) {
        connections[session.id]?.receive(message.payload)
    }

    override fun afterConnectionClosed(session: WebSocketSession, status: CloseStatus) {
        connections.remove(session.id)?.disconnected()
    }
}
