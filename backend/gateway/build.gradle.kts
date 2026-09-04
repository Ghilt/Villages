plugins {
    id("villages.kotlin-module")
}

// The WebSocket edge: sessions, cell subscriptions, snapshot then deltas, command intake.
dependencies {
    implementation(project(":application"))
    implementation(project(":protocol"))
    implementation(project(":infrastructure-rabbit"))
}
