package villages.archtests

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import java.io.File

/**
 * No Kotlin file may pass 400 lines, and one already past it may only get shorter.
 *
 * `size-ceilings.txt`, at the repository root, lists every source file over the limit with its length today. A
 * listed file that grows fails here, and so does one that shrinks without its number coming down with it, and
 * one that is not listed and passes the limit. The files every mechanic used to grow by a few dozen lines were
 * exactly the long ones, so holding them is what makes a change find a place of its own. The rest of the
 * repository - the TypeScript, the stylesheets, the scripts - is held to the same list by
 * frontend/tools/sizes.test.ts. See docs/adr/0072.
 */
class SizeCeilingsSpec : StringSpec({

    "every Kotlin file past the limit is on the list, at its length today" {
        val listed = ceilings().filterKeys { it.endsWith(".kt") }
        val measured = SOURCES.flatMap(::kotlinFilesUnder).associate { pathOf(it) to linesOf(it) }
        val problems = buildList {
            for ((path, lines) in measured.toSortedMap()) {
                val ceiling = listed[path]
                when {
                    ceiling == null -> if (lines > MOST) add("$path is $lines lines, past $MOST: move something out of it")
                    lines > ceiling -> add("$path grew from $ceiling to $lines lines: move something out of it first")
                    lines <= MOST -> add("$path is down to $lines lines: take it off size-ceilings.txt")
                    lines < ceiling -> add("$path came down to $lines lines: lower its number in size-ceilings.txt")
                }
            }
            for (path in (listed.keys - measured.keys).sorted()) {
                add("$path is on size-ceilings.txt and is not in the tree: take it off")
            }
        }
        problems shouldBe emptyList()
    }

    "every module the build includes is measured" {
        val settings = File("../../backend/settings.gradle.kts").readText()
        val block = Regex("""include\((.*?)\)""", RegexOption.DOT_MATCHES_ALL).find(settings)?.groupValues?.get(1).orEmpty()
        val included = Regex(""""([A-Za-z-]+)"""").findAll(block).map { it.groupValues[1] }.toSortedSet()
        val measured = SOURCES.map { File(it).parentFile.name }.toSortedSet()
        measured - "buildSrc" shouldBe included
    }
})

private const val MOST = 400

/**
 * Every Kotlin source root, each named on its own, because each is a folder the build has to be told these tests
 * read; naming `backend` whole would make every module's build output an input too. Tests run from the module's
 * own directory, so the repository root is two above it.
 */
private val SOURCES = listOf(
    "../../backend/domain/src",
    "../../backend/application/src",
    "../../backend/protocol/src",
    "../../backend/infrastructure-occurrent/src",
    "../../backend/infrastructure-rabbit/src",
    "../../backend/projections/src",
    "../../backend/gateway/src",
    "../../backend/accounts/src",
    "../../backend/app/src",
    "../../backend/arch-tests/src",
    "../../backend/load-bots/src",
    "../../backend/buildSrc/src",
)

private val ROOT: File = File("../..").canonicalFile

/** The list, as path to the length it may not pass. Blank lines and the comments at its head say nothing. */
private fun ceilings(): Map<String, Int> =
    File("../../size-ceilings.txt").readLines()
        .map { it.trim() }
        .filter { it.isNotEmpty() && !it.startsWith("#") }
        .associate { line ->
            val (lines, path) = line.split(' ', limit = 2)
            path to lines.toInt()
        }

private fun kotlinFilesUnder(root: String): List<File> =
    File(root).walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()

private fun pathOf(file: File): String = file.canonicalFile.relativeTo(ROOT).invariantSeparatorsPath

/** As an editor numbers them: every line break, and the last line when it has none. */
private fun linesOf(file: File): Int = file.readLines().size
