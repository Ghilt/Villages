/**
 * What every backend module has in common, so that a module's own build file says only what makes it
 * different: which other modules it may depend on.
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

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
}
