/**
 * What every backend module has in common, so that a module's own build file says only what makes it
 * different: which other modules it may depend on, and which files outside it its tests read.
 *
 * Kotlin on a Java 21 toolchain, tests on Kotest over the JUnit platform. The toolchain is pinned rather
 * than inherited from whatever JDK runs Gradle, so a wrong JDK is a loud failure and not a subtle one;
 * Gradle fetches the right one if the machine has not got it.
 */
plugins {
    kotlin("jvm")
}

val libs = the<VersionCatalogsExtension>().named("libs")

group = "villages"

kotlin {
    jvmToolchain(libs.findVersion("java").get().requiredVersion.toInt())
}

dependencies {
    testImplementation(libs.findLibrary("kotest-runner").get())
    testImplementation(libs.findLibrary("kotest-assertions").get())
}

val testsRead = extensions.create<TestsRead>("testsRead")
val repository: File = rootDir.parentFile

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
    // Never taken from the build cache, which every tree on the machine shares (gradle.properties): a test that
    // skips itself when Docker is not running would be remembered as passed for a tree where it is.
    outputs.cacheIf("a test's result depends on what is running on the machine, not only on its inputs") { false }
    inputs.files(testsRead.paths.map { paths -> paths.map { repository.resolve(it) } })
        .withPropertyName("testsRead")
        .withPathSensitivity(PathSensitivity.RELATIVE)
}

// Tests run from the module directory, two below the repository root, so a test opens a file outside its
// module by a path starting ../../, and one its build file does not name can change without the tests running.
val checkTestsRead = tasks.register("checkTestsRead") {
    group = "verification"
    description = "Fails when a test reads a file outside the module that its build file does not name."
    val sources = fileTree("src/test") { include("**/*.kt") }
    val named = testsRead.paths
    val module = project.path
    val buildFilePath = project.buildFile.relativeTo(repository).invariantSeparatorsPath
    doLast {
        val names = named.get()
        // The group is the path as far as the first template, which is as much of it as is fixed.
        val opened = Regex(""""\.\./\.\./([^"$]*)[^"]*"""")
        val unnamed = sources.files.sortedBy { it.name }.flatMap { source ->
            opened.findAll(source.readText())
                .filter { read ->
                    val fixed = read.groupValues[1]
                    names.none { fixed == it || fixed.startsWith("$it/") }
                }
                .map { "${source.name} reads ${it.value.trim('"')}" }
                .toList()
        }.distinct()
        if (unnamed.isNotEmpty()) {
            throw GradleException(
                "The tests of $module read files outside the module that $buildFilePath does not name, so a " +
                    "change to one of them alone would leave the tests up to date and report the last run's " +
                    "green:\n\n" + unnamed.joinToString("\n") { "  $it" } + "\n\nName each there with " +
                    "testsRead(\"<its path from the repository root>\"). See docs/TESTING.md.",
            )
        }
    }
}

tasks.named("check") {
    dependsOn(checkTestsRead)
}
