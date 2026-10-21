plugins {
    // Gradle provisions the JDK the toolchain asks for, so a machine with only Temurin 17 on it still
    // compiles for 21. The daemon itself runs on whatever JAVA_HOME points at.
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

rootProject.name = "villages"

// The layers, in the order they may depend on each other. See docs/ARCHITECTURE.md and the edges each
// module's own build file declares: a module cannot import what it does not depend on, and arch-tests
// checks the rest.
include(
    "domain",
    "application",
    "protocol",
    "infrastructure-occurrent",
    "infrastructure-rabbit",
    "projections",
    "gateway",
    "accounts",
    "app",
    "arch-tests",
    "load-bots",
)

dependencyResolutionManagement {
    repositories {
        mavenCentral()
    }
    repositoriesMode = RepositoriesMode.FAIL_ON_PROJECT_REPOS
}
