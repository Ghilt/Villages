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
}
