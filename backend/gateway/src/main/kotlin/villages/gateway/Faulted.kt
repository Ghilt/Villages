package villages.gateway

import villages.application.Faults
import villages.protocol.ErrorFrame

/**
 * Anything acting on its own that threw, told to every window there is, because the debug panel in each is where it
 * is seen, and a read model missing an event is otherwise only a map that is quietly wrong. The stack is in the
 * server's log; this is the one line of it. See decision records 0023 and 0029.
 */
internal fun toldEveryWindow(faults: Faults, windows: () -> List<Outbound>): AutoCloseable = faults.watch { fault ->
    val told = ErrorFrame("fault", fault.describe())
    for (window in windows()) {
        window.send(told)
    }
}
