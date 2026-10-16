package villages.bots

import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.KotlinModule
import java.io.File
import java.time.Instant
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/** Which code a run measured: the commit, its branch, and whether the tree had changes beyond it. */
data class Code(val commit: String, val branch: String, val dirty: Boolean) {
    companion object {
        fun of(repository: File): Code {
            fun git(vararg args: String): String {
                val asked = ProcessBuilder("git", *args).directory(repository).redirectErrorStream(true).start()
                val said = asked.inputStream.bufferedReader().readText().trim()
                asked.waitFor(10, TimeUnit.SECONDS)
                return said
            }
            return Code(git("rev-parse", "HEAD"), git("branch", "--show-current"), git("status", "--porcelain").isNotEmpty())
        }
    }
}

/** What a run ran on, since the bots and the server share it and a number means nothing without its machine. */
data class Machine(val name: String, val os: String, val cpu: String, val cores: Int, val memoryGb: Long) {
    companion object {
        fun here(): Machine {
            val system = java.lang.management.ManagementFactory.getOperatingSystemMXBean()
            val memory = (system as? com.sun.management.OperatingSystemMXBean)?.totalMemorySize ?: 0
            return Machine(
                name = System.getenv("COMPUTERNAME") ?: System.getenv("HOSTNAME") ?: "unknown",
                os = "${System.getProperty("os.name")} ${System.getProperty("os.version")}",
                cpu = System.getenv("PROCESSOR_IDENTIFIER") ?: System.getProperty("os.arch"),
                cores = Runtime.getRuntime().availableProcessors(),
                memoryGb = memory / (1L shl 30),
            )
        }
    }
}

/**
 * One run, as `docs/experiments/performance/runs.jsonl` keeps it and the performance page reads it: one JSON object a
 * line. `carried` is the last judged stage that did not bend; `bentAt` the stage that did, if one did.
 */
data class RunLine(
    val at: String,
    val code: Code,
    val machine: Machine,
    val settings: Settings,
    val serverHeapGb: Int,
    val startupMs: Long?,
    val carried: Int?,
    val bentAt: Int?,
    val bent: String?,
    val aborted: Boolean,
    val abortedWhy: String?,
    val stages: List<StageResult>,
)

/**
 * The history of runs, appended to once a run, when it ends, however it ends: a run stopped by Ctrl+C is written by
 * the shutdown hook as aborted, with the stages it got through; a second [finish] of the same run writes nothing.
 */
class History(private val file: File, private val code: Code, private val machine: Machine, private val settings: Settings, private val serverHeapGb: Int) {
    private val written = AtomicBoolean()

    fun finish(run: RunResult, at: Instant = Instant.now()): Boolean {
        if (!written.compareAndSet(false, true)) return false
        file.parentFile.mkdirs()
        file.appendText(MAPPER.writeValueAsString(lineOf(run, at)) + "\n")
        return true
    }

    private fun lineOf(run: RunResult, at: Instant): RunLine {
        val judged = run.stages.filterNot { it.warmUp }
        val bent = judged.lastOrNull()?.takeIf { it.bent != null }
        return RunLine(
            at = at.toString(),
            code = code,
            machine = machine,
            settings = settings,
            serverHeapGb = serverHeapGb,
            startupMs = run.started?.tookMs,
            carried = judged.lastOrNull { it.bent == null }?.players,
            bentAt = bent?.players,
            bent = bent?.bent,
            aborted = run.aborted != null,
            abortedWhy = run.aborted,
            stages = run.stages,
        )
    }

    companion object {
        val MAPPER: JsonMapper = JsonMapper.builder().addModule(KotlinModule.Builder().build()).build()
    }
}
