package villages.bots

import java.net.URI
import java.net.http.HttpClient
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.system.exitProcess

/**
 * One bot against a game server that is already running, to watch a simulated player play: `--port` is the game
 * server's, which `node frontend/apps/web/vite/worktreePort.ts --game` prints for a tree. It plays until stopped, and
 * every ten seconds says what it did and how long the server took.
 */
fun main(args: Array<String>) {
    val port = args.firstNotNullOfOrNull { it.removePrefix("--port=").takeIf { p -> p != it } }?.toIntOrNull()
    if (port == null) {
        System.err.println("usage: --port=<the game server's port>")
        exitProcess(2)
    }
    val trips = RoundTrips()
    val clock = Executors.newSingleThreadScheduledExecutor()
    lateinit var bot: Bot
    val wire = JdkWire.open(
        HttpClient.newHttpClient(),
        URI("ws://localhost:$port/ws"),
        heard = { bot.heard(it) },
        ended = { bot.gone(it); println("the socket ended: $it"); clock.shutdown() },
    ).get(10, TimeUnit.SECONDS)
    bot = Bot(wire, trips)
    println("player ${bot.token} on port $port")
    bot.opened()
    clock.scheduleAtFixedRate(bot::tick, 1, 1, TimeUnit.SECONDS)
    clock.scheduleAtFixedRate({ report(bot, trips) }, 10, 10, TimeUnit.SECONDS)
    clock.awaitTermination(Long.MAX_VALUE, TimeUnit.DAYS)
}

private fun report(bot: Bot, trips: RoundTrips) {
    trips.overdue(System.currentTimeMillis(), limit = 5_000)
    val measured = trips.drain()
    val said = Trip.entries.joinToString("  ") { trip ->
        val took = measured.took.getValue(trip)
        if (took.isEmpty()) "" else "${trip.name.lowercase()} ${took.size}x ${took.max()} ms"
    }.trim()
    val failed = if (measured.failed == 0) "" else "  failed ${measured.reasons}"
    println("${bot.stage.name.lowercase()}  $said$failed")
}
