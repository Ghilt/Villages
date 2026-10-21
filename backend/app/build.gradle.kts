plugins {
    id("villages.kotlin-module")
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.spring.boot)
}

// The one module that boots. It wires everything and holds the only @SpringBootApplication; arch-tests
// fails if another appears.
dependencies {
    implementation(platform(libs.spring.boot.dependencies))
    implementation(libs.spring.boot.starter)
    implementation(libs.spring.boot.starter.websocket)
    // The web server's half of the accounts: the sign-in's endpoints under /auth, behind Spring Security. See
    // docs/plans/accounts.md.
    implementation(libs.spring.boot.starter.security)
    implementation(libs.jackson.module.kotlin)
    implementation(project(":domain"))
    implementation(project(":application"))
    implementation(project(":protocol"))
    implementation(project(":infrastructure-occurrent"))
    implementation(project(":infrastructure-rabbit"))
    implementation(project(":projections"))
    implementation(project(":gateway"))
    implementation(project(":accounts"))
    testImplementation(libs.spring.boot.starter.test)
}

// The server reads the portraits from the repository, and its tests check that it finds them there; it reads the
// names as the world package files them, which the shared fixture holds both ends to; and it reads the catalogue of
// structures, which the server will not start without and whose fixture holds both readers to one shape.
testsRead(
    "world/portraits", "contracts/fixtures/names.json", "world/catalogues", "contracts/fixtures/structures.json",
    "contracts/fixtures/balance.json", "contracts/fixtures/fate.json", "contracts/fixtures/character-names.json",
    "contracts/fixtures/dialogue.json", "contracts/fixtures/quest.json", "contracts/fixtures/challenges.json",
    "world/ruins.json",
    // The world's master, which the server names as the page does.
    "frontend/packages/world/src/masters.ts",
)
