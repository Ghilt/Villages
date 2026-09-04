plugins {
    id("villages.kotlin-module")
}

// Read models built from durable subscriptions. The map is served from here, never from the event store.
dependencies {
    implementation(project(":application"))
    implementation(project(":domain"))
    implementation(project(":infrastructure-occurrent"))
}
