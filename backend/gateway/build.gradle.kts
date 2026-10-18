plugins {
    id("villages.kotlin-module")
}

// The WebSocket edge: sessions, cell subscriptions, snapshot then deltas, command intake.
dependencies {
    implementation(project(":domain"))
    implementation(project(":application"))
    implementation(project(":protocol"))
    implementation(project(":infrastructure-rabbit"))
    // Tests run the gateway over the real read model rather than a fake of it.
    testImplementation(project(":projections"))
    // Every refusal there is, found through the sealed hierarchy, for the record of their codes.
    testImplementation(kotlin("reflect"))
}

// Every code a refusal has carried on the wire, which the page's words are keyed by.
testsRead("contracts/refusal-codes.txt")
