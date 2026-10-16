package villages.bots

import java.net.URI
import java.net.http.HttpClient
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.ExecutionException
import java.util.concurrent.Executors
import java.util.concurrent.Semaphore
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

/** What a ramp asks of its bots. A test stands a fake in for it. */
interface Bots : AutoCloseable {
    /** Opens bots until there are `count`, and returns once each has opened or failed to. */
    fun growTo(count: Int)

    /** Bots that are no longer playing: never connected, ended by the server, or told to go. */
    fun lost(): Int

    val trips: RoundTrips
}

/**
 * Every bot of a run against one server, sharing one `HttpClient` and one clock. Bots are opened a few hundred at a
 * time, so the server sees arrivals rather than a single wall of them, and each trip not answered within five seconds
 * is a failure.
 */
class Swarm(private val port: Int, private val pace: Pace = Pace()) : Bots {
    override val trips = RoundTrips()
    private val client = HttpClient.newHttpClient()
    private val playing = ConcurrentLinkedQueue<Pair<Bot, Wire>>()
    private val opening = Semaphore(OPENING_AT_ONCE)
    private val neverConnected = AtomicInteger()
    private val clock = Executors.newSingleThreadScheduledExecutor { Thread(it, "swarm clock").apply { isDaemon = true } }

    init {
        clock.scheduleAtFixedRate(::tick, 1, 1, TimeUnit.SECONDS)
    }

    override fun growTo(count: Int) {
        val opened = playing.size + neverConnected.get()
        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(GROWING_SECONDS)
        val asked = (opened until count).mapNotNull {
            // A server that has stopped answering never lets a socket finish opening; past the deadline the rest are
            // never asked for, and are lost.
            val left = deadline - System.nanoTime()
            if (left <= 0 || !opening.tryAcquire(left, TimeUnit.NANOSECONDS)) {
                neverConnected.incrementAndGet()
                trips.failure("not opened within $GROWING_SECONDS s")
                return@mapNotNull null
            }
            // The server says nothing before hello, which the bot says once it has its wire; the socket may end sooner.
            val bot = AtomicReference<Bot>()
            JdkWire.open(client, URI("ws://localhost:$port/ws"), heard = { bot.get()?.heard(it) }, ended = { bot.get()?.gone(it) })
                .whenComplete { wire, failed ->
                    opening.release()
                    if (failed != null) {
                        neverConnected.incrementAndGet()
                        trips.failure("could not connect: ${failed.cause?.javaClass?.simpleName ?: failed.javaClass.simpleName}")
                    } else {
                        val newcomer = Bot(wire, trips, pace).also(bot::set)
                        playing += newcomer to wire
                        newcomer.opened()
                    }
                }
        }
        val left = (deadline - System.nanoTime()).coerceAtLeast(0)
        try {
            CompletableFuture.allOf(*asked.toTypedArray()).get(left, TimeUnit.NANOSECONDS)
        } catch (@Suppress("SwallowedException") late: TimeoutException) {
            asked.filterNot { it.isDone }.forEach { _ -> neverConnected.incrementAndGet(); trips.failure("not opened within $GROWING_SECONDS s") }
        } catch (@Suppress("SwallowedException") failed: ExecutionException) {
            // Each failure was counted where it happened.
        }
    }

    override fun lost(): Int = neverConnected.get() + playing.count { it.first.stage == Bot.Stage.GONE }

    override fun close() {
        clock.shutdownNow()
        playing.forEach { it.second.close() }
        client.shutdownNow()
    }

    private fun tick() {
        playing.forEach { it.first.tick() }
        trips.overdue(System.currentTimeMillis(), OVERDUE_MS)
    }

    private companion object {
        const val OPENING_AT_ONCE = 200
        const val GROWING_SECONDS = 180L
        const val OVERDUE_MS = 5_000L
    }
}
