plugins {
    id("villages.kotlin-module")
}

// Sees every module, in test scope only, so ArchUnit can read all the classes and hold them to the layer
// rules. The rules themselves arrive in increment 0.6.
dependencies {
    testImplementation(libs.archunit)
    testImplementation(project(":domain"))
    testImplementation(project(":application"))
    testImplementation(project(":protocol"))
    testImplementation(project(":infrastructure-occurrent"))
    testImplementation(project(":infrastructure-rabbit"))
    testImplementation(project(":projections"))
    testImplementation(project(":gateway"))
    testImplementation(project(":app"))
    // The swarm is held to the rules too: it speaks the protocol and nothing else. Leaving it out made
    // its layer empty, which the layered rule rightly refused.
    testImplementation(project(":load-bots"))
}

// The size ceilings, and every Kotlin file they are held against. Each module's sources are named on their own
// rather than `backend` whole, which would make every module's build output an input too. See docs/adr/0072.
testsRead(
    "size-ceilings.txt",
    "backend/settings.gradle.kts",
    "backend/domain/src",
    "backend/application/src",
    "backend/protocol/src",
    "backend/infrastructure-occurrent/src",
    "backend/infrastructure-rabbit/src",
    "backend/projections/src",
    "backend/gateway/src",
    "backend/app/src",
    "backend/arch-tests/src",
    "backend/load-bots/src",
    "backend/buildSrc/src",
)
