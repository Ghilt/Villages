package villages.bots

import java.io.File
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.time.Duration
import java.util.concurrent.TimeUnit

/** The one server a run measures: started, read now and then, and stopped. A test stands a fake in for it. */
interface Server {
    /** Starts it and waits until its port answers, and says how long that took and where it is. */
    fun start(): Started

    /** What it holds now: its heap after a collection, its threads, and the CPU it has used so far. */
    fun read(): Reading

    fun stop()
}

data class Started(val port: Int, val tookMs: Long)

data class Reading(val heapUsedMb: Long, val heapTotalMb: Long, val threads: Int, val cpuMs: Long)

/**
 * The game server's own jar, run as the player's server and nobody else's: on a port the operating system picks, so
 * that it is no tree's; its world in memory and no broker, so nothing it holds outlives it or reaches another tree;
 * the instruments closed; and Tomcat let take more connections than the swarm will open, so the first limit met is
 * ours. Started in `backend/app`, as the folders it reads assume. Read from outside with the JDK's own `jcmd`.
 */
class JarServer(private val java: File, private val jar: File, private val log: File) : Server {
    private var process: Process? = null

    override fun start(): Started {
        val port = ServerSocket(0).use { it.localPort }
        val from = System.nanoTime()
        log.parentFile.mkdirs()
        val started = ProcessBuilder(
            java.path, "-jar", jar.path,
            "--server.port=$port",
            "--villages.store=memory",
            "--villages.instruments=false",
            "--server.tomcat.max-connections=$MOST_CONNECTIONS",
            "--server.tomcat.accept-count=$MOST_CONNECTIONS",
        ).directory(jar.parentFile.parentFile.parentFile).redirectErrorStream(true).redirectOutput(log).start()
        process = started
        val deadline = from + TimeUnit.SECONDS.toNanos(STARTING_SECONDS)
        while (!answers(port)) {
            check(started.isAlive) { "the server stopped as it started; its log is $log" }
            check(System.nanoTime() < deadline) { "the server did not answer within $STARTING_SECONDS s; its log is $log" }
            Thread.sleep(100)
        }
        return Started(port, (System.nanoTime() - from) / 1_000_000)
    }

    override fun read(): Reading {
        val pid = checkNotNull(process) { "not started" }.pid()
        jcmd(pid, "GC.run")
        val heap = HEAP.find(jcmd(pid, "GC.heap_info"))
        val threads = jcmd(pid, "Thread.print").lineSequence().count { it.startsWith("\"") }
        val cpu = ProcessHandle.of(pid).flatMap { it.info().totalCpuDuration() }.map(Duration::toMillis).orElse(0)
        return Reading(
            heapUsedMb = heap?.groupValues?.get(2)?.toLong()?.div(1024) ?: -1,
            heapTotalMb = heap?.groupValues?.get(1)?.toLong()?.div(1024) ?: -1,
            threads = threads,
            cpuMs = cpu,
        )
    }

    override fun stop() {
        val running = process ?: return
        running.destroy()
        if (!running.waitFor(STOPPING_SECONDS, TimeUnit.SECONDS)) running.destroyForcibly().waitFor()
        process = null
    }

    private fun jcmd(pid: Long, command: String): String {
        val tool = File(java.parentFile, if (java.name.endsWith(".exe")) "jcmd.exe" else "jcmd")
        val asked = ProcessBuilder(tool.path, "$pid", command).redirectErrorStream(true).start()
        val said = asked.inputStream.bufferedReader().readText()
        asked.waitFor(30, TimeUnit.SECONDS)
        return said
    }

    private fun answers(port: Int): Boolean = try {
        Socket().use { it.connect(InetSocketAddress("localhost", port), 200) }
        true
    } catch (@Suppress("SwallowedException") closed: java.io.IOException) {
        false
    }

    companion object {
        const val MOST_CONNECTIONS = 20_000
        private const val STARTING_SECONDS = 120L
        private const val STOPPING_SECONDS = 10L

        // G1's own words: "garbage-first heap   total 262144K, used 23456K [...".
        private val HEAP = Regex("""total (\d+)K, used (\d+)K""")
    }
}
