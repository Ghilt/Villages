package villages.app

import jakarta.websocket.ContainerProvider
import jakarta.websocket.WebSocketContainer

/** What the tests' own windows connect with. */
object TestSockets {
    /**
     * A socket container that takes a frame as large as the gateway sends, as a browser does. The standard one gives
     * up at eight kilobytes, and an event carrying a whole catalogue is larger than that (decision record 0097).
     */
    val LARGE_FRAMES: WebSocketContainer = ContainerProvider.getWebSocketContainer().apply {
        defaultMaxTextMessageBufferSize = 1 shl 20
    }
}
