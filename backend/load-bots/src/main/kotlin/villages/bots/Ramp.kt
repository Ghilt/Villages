package villages.bots

/**
 * How a run ramps: the players of each stage, how long each is held once its last bot is in, and when a stage bends -
 * the slowest twentieth of some round trip over `bendMs`, or more than `bendShare` of its trips or of its bots failed.
 * A server is cold once, as it starts, and its first calls are slow until the JVM has compiled them: ten players took
 * 745 ms to be welcomed on a server just started. So a run begins with a **warm-up** of `warmUp` players held
 * `warmUpMs`, measured and shown but never judged, and they stay on into the first stage.
 */
data class Settings(
    val stages: List<Int> = listOf(100, 1_000, 2_500, 5_000, 10_000),
    val warmUp: Int = 50,
    val warmUpMs: Long = 20_000,
    val holdMs: Long = 60_000,
    val bendMs: Long = 500,
    val bendShare: Double = 0.01,
)

data class Percentiles(val count: Int, val p50: Long, val p95: Long, val p99: Long)

/**
 * One stage as it was measured. `cpuMs` is the server's over this stage alone; `bent` says why it bent, if it did, and
 * is never said of the warm-up.
 */
data class StageResult(
    val players: Int,
    val warmUp: Boolean,
    val rampMs: Long,
    val trips: Map<Trip, Percentiles?>,
    val failedTrips: Int,
    val lostBots: Int,
    val reasons: Map<String, Int>,
    val reading: Reading,
    val cpuMs: Long,
    val bent: String?,
)

/** A whole run: when its server answered, the stages it got through, and why it stopped early when it did. */
data class RunResult(val started: Started?, val stages: List<StageResult>, val aborted: String?)

/**
 * The run itself: starts the one server, ramps the bots at it stage by stage, measures each, and stops at the first
 * stage that bends. It stops the bots and the server however it ends, a stage that throws included, and what it
 * measured until then is kept.
 */
class Ramp(
    private val server: Server,
    private val swarm: (port: Int) -> Bots,
    private val settings: Settings = Settings(),
    private val onStarted: (Started) -> Unit = {},
    private val onStage: (StageResult) -> Unit = {},
    private val sleep: (Long) -> Unit = Thread::sleep,
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun run(): RunResult {
        var started: Started? = null
        val stages = mutableListOf<StageResult>()
        var bots: Bots? = null
        try {
            started = server.start().also(onStarted)
            val playing = swarm(started.port).also { bots = it }
            var cpuBefore = server.read().cpuMs
            val warmUp = if (settings.warmUp > 0) listOf(settings.warmUp to settings.warmUpMs) else emptyList()
            for ((index, planned) in (warmUp + settings.stages.map { it to settings.holdMs }).withIndex()) {
                val (players, holdMs) = planned
                val from = now()
                playing.growTo(players)
                val rampMs = now() - from
                sleep(holdMs)
                val reading = server.read()
                val warming = index < warmUp.size
                val stage = measure(players, warming, rampMs, playing, reading, reading.cpuMs - cpuBefore)
                cpuBefore = reading.cpuMs
                stages += stage
                onStage(stage)
                if (stage.bent != null) break
            }
            return RunResult(started, stages, aborted = null)
        } catch (@Suppress("TooGenericExceptionCaught") broken: Exception) {
            return RunResult(started, stages, aborted = "${broken.javaClass.simpleName}: ${broken.message}")
        } finally {
            bots?.close()
            server.stop()
        }
    }

    private fun measure(players: Int, warming: Boolean, rampMs: Long, bots: Bots, reading: Reading, cpuMs: Long): StageResult {
        val measured = bots.trips.drain()
        val trips = Trip.entries.associateWith { trip ->
            val took = measured.took.getValue(trip)
            if (took.isEmpty()) {
                null
            } else {
                Percentiles(
                    took.size,
                    measured.percentile(trip, P50)!!,
                    measured.percentile(trip, P95)!!,
                    measured.percentile(trip, P99)!!,
                )
            }
        }
        val lost = bots.lost()
        val bent = if (warming) null else bend(trips, measured.failed, lost, players)
        return StageResult(players, warming, rampMs, trips, measured.failed, lost, measured.reasons, reading, cpuMs, bent)
    }

    private fun bend(trips: Map<Trip, Percentiles?>, failed: Int, lost: Int, players: Int): String? {
        val slow = trips.entries.firstOrNull { (_, p) -> p != null && p.p95 > settings.bendMs }
        if (slow != null) return "p95 ${slow.key.name.lowercase()} ${slow.value!!.p95} ms, over ${settings.bendMs}"
        val made = trips.values.sumOf { it?.count ?: 0 }
        if (failed > (made + failed) * settings.bendShare) return "$failed of ${made + failed} trips failed"
        if (lost > players * settings.bendShare) return "$lost of $players bots lost"
        return null
    }

    private companion object {
        const val P50 = 0.50
        const val P95 = 0.95
        const val P99 = 0.99
    }
}
