package villages.bots

import java.io.File

/**
 * The swarm, run by hand: `./gradlew :load-bots:swarm`, with `--args="--stages=100,500 --hold=20"` for a short run.
 * The Gradle task names the java to run the server with, its jar and where its log goes. Prints each stage as it is
 * measured and the whole run at the end.
 */
fun main(args: Array<String>) {
    val given = args.associate { it.removePrefix("--").substringBefore('=') to it.substringAfter('=', "") }
    val settings = Settings().let { defaults ->
        defaults.copy(
            stages = given["stages"]?.split(',')?.map { it.trim().toInt() } ?: defaults.stages,
            holdMs = given["hold"]?.toLong()?.times(1_000) ?: defaults.holdMs,
            warmUp = given["warm-up"]?.toInt() ?: defaults.warmUp,
        )
    }
    val repository = File(System.getProperty("villages.repository"))
    val server = JarServer(
        java = File(System.getProperty("villages.java")),
        jar = File(System.getProperty("villages.jar")),
        log = File(repository, ".logs/swarm-server.log"),
    )
    val history = History(
        File(repository, "docs/experiments/performance/runs.jsonl"),
        Code.of(repository),
        Machine.here(),
        settings,
        JarServer.HEAP_GB,
    )
    // Ctrl+C ends the JVM without the run's `finally`: the server it started goes with it all the same, and the run
    // is written down as aborted, with the stages it got through.
    var started: Started? = null
    val stages = java.util.concurrent.CopyOnWriteArrayList<StageResult>()
    Runtime.getRuntime().addShutdownHook(
        Thread {
            server.stop()
            if (history.finish(RunResult(started, stages, aborted = "interrupted"))) println("written down as aborted")
        },
    )

    println(
        "a warm-up of ${settings.warmUp} for ${settings.warmUpMs / 1_000} s, then stages ${settings.stages.joinToString()}, " +
            "each held ${settings.holdMs / 1_000} s",
    )
    println(Report.HEADER)
    val run = Ramp(
        server,
        { port -> Swarm(port) },
        settings,
        onStarted = { started = it },
        onStage = { stage ->
            stages += stage
            println(Report.line(stage))
            // What the heap holds by class at each stage, when asked for: what a player costs, and in what.
            if ("histogram" in given) server.histogram(File(repository, ".logs/swarm-histogram-${stage.players}.txt"))
        },
    ).run()
    history.finish(run)
    println(Report.summary(run))
    println("written to docs/experiments/performance/runs.jsonl")
}

/** The run as a table a terminal reads: one line a stage. */
object Report {
    val HEADER = String.format(
        "%7s %7s  %-17s %-17s %-17s %6s %5s %9s %7s %7s  %s",
        "players", "ramp s", "welcome p50/95/99", "answer p50/95/99", "cells p50/95/99",
        "failed", "lost", "heap MB", "threads", "cpu s", "bent",
    )

    fun line(stage: StageResult): String = String.format(
        "%7d %7.1f  %-17s %-17s %-17s %6d %5d %9s %7d %7.1f  %s",
        stage.players, stage.rampMs / 1_000.0,
        trip(stage.trips[Trip.WELCOME]), trip(stage.trips[Trip.ACCEPTED]), trip(stage.trips[Trip.SNAPSHOT]),
        stage.failedTrips, stage.lostBots, "${stage.reading.heapUsedMb}/${stage.reading.heapTotalMb}",
        stage.reading.threads, stage.cpuMs / 1_000.0, if (stage.warmUp) "(warm-up, not judged)" else stage.bent ?: "",
    )

    fun summary(run: RunResult): String = buildString {
        run.started?.let { append("server answered in ${it.tookMs} ms on port ${it.port}\n") }
        val last = run.stages.lastOrNull { !it.warmUp }
        when {
            run.aborted != null -> append("aborted: ${run.aborted}")
            last == null -> append("no stage was measured")
            last.bent != null -> append("bent at ${last.players} players: ${last.bent}")
            else -> append("carried ${last.players} players without bending")
        }
        run.stages.flatMap { it.reasons.entries }.groupBy({ it.key }, { it.value }).forEach { (why, counts) ->
            append("\n  failed ${counts.sum()}x: $why")
        }
    }

    private fun trip(p: Percentiles?): String = if (p == null) "-" else "${p.p50}/${p.p95}/${p.p99}"
}
