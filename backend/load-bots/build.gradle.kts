plugins {
    id("villages.kotlin-module")
}

// A swarm of WebSocket clients for the scale proof in Phase 2. Speaks the protocol and nothing else.
dependencies {
    implementation(project(":protocol"))
}
