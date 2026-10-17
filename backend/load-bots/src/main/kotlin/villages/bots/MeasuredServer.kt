package villages.bots

import java.io.File
import java.io.RandomAccessFile
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

    /** What has gone wrong with it that a player would feel - it died, or ran out of memory - or null while it is well. */
    fun trouble(): String?

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
class JarServer(private val java: File, private val jar: File, private val log: File, private val heapGb: Int = HEAP_GB) : Server {
    private var process: Process? = null
    private var logRead = 0L
    private var troubled: String? = null

    override fun start(): Started {
        val port = ServerSocket(0).use { it.localPort }
        val from = System.nanoTime()
        log.parentFile.mkdirs()
        val started = ProcessBuilder(
            // Pinned rather than the JVM's quarter of whatever machine it is on, so runs compare.
            java.path, "-Xmx${heapGb}g", "-jar", jar.path,
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

    override fun trouble(): String? {
        troubled?.let { return it }
        val running = process ?: return null
        if (!running.isAlive) troubled = "the server stopped, with exit code ${running.exitValue()}"
        // Only what the log has said since the last look, so a long log is read once.
        if (troubled == null && log.length() > logRead) {
            RandomAccessFile(log, "r").use { file ->
                file.seek(logRead)
                val said = ByteArray((file.length() - logRead).toInt()).also { file.readFully(it) }.decodeToString()
                logRead = file.length()
                if ("OutOfMemoryError" in said) troubled = "the server ran out of memory, at its ${heapGb} GB"
            }
        }
        return troubled
    }

    override fun read(): Reading {
        val running = checkNotNull(process) { "not started" }
        if (!running.isAlive) return Reading(heapUsedMb = -1, heapTotalMb = -1, threads = 0, cpuMs = 0)
        val pid = running.pid()
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

    /** What the heap holds, by class, largest first: `jcmd GC.class_histogram`, for finding what a player costs. */
    fun histogram(to: File) {
        val running = process?.takeIf { it.isAlive } ?: return
        to.parentFile.mkdirs()
        to.writeText(jcmd(running.pid(), "GC.class_histogram"))
    }

    override fun stop() {
        val running = process ?: return
        running.destroy()
        if (!running.waitFor(STOPPING_SECONDS, TimeUnit.SECONDS)) running.destroyForcibly().waitFor()
        process = null
    }

    // Into a file and not a pipe, so a server too far gone to answer cannot hold the run: given up on after a while.
    private fun jcmd(pid: Long, command: String): String {
        val tool = File(java.parentFile, if (java.name.endsWith(".exe")) "jcmd.exe" else "jcmd")
        val out = File.createTempFile("jcmd", ".txt")
        try {
            val asked = ProcessBuilder(tool.path, "$pid", command).redirectErrorStream(true).redirectOutput(out).start()
            if (!asked.waitFor(JCMD_SECONDS, TimeUnit.SECONDS)) {
                asked.destroyForcibly()
                return ""
            }
            return out.readText()
        } finally {
            out.delete()
        }
    }

    private fun answers(port: Int): Boolean = try {
        Socket().use { it.connect(InetSocketAddress("localhost", port), 200) }
        true
    } catch (@Suppress("SwallowedException") closed: java.io.IOException) {
        false
    }

    companion object {
        const val MOST_CONNECTIONS = 20_000
        const val HEAP_GB = 8
        private const val STARTING_SECONDS = 120L
        private const val STOPPING_SECONDS = 10L
        private const val JCMD_SECONDS = 60L

        // G1's own words, which JDK 25 changed: "total 262144K, used 23456K" on 21, "total reserved 262144K, committed
        // 262144K, used 25238K" on 25, where what is committed is the heap the server has, as the total was on 21.
        internal val HEAP = Regex("""(?:total|committed) (\d+)K, used (\d+)K""")
    }
}
