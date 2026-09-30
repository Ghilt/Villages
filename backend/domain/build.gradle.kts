plugins {
    id("villages.kotlin-module")
}

// Nothing. The domain depends on the Kotlin standard library and on nothing else: no Spring, no
// Occurrent, no CloudEvents, no Jackson. This empty block is the first place that is enforced, because
// an import of something not declared here does not compile.
dependencies {
    testImplementation(libs.kotest.property)
    // Test scope only: the catalogue test reads an event's fields off its constructor. The domain itself stays
    // on the standard library.
    testImplementation(kotlin("reflect"))
}

// The catalogue test holds the events to the table in docs/EVENTS.md.
testsRead("docs/EVENTS.md")
