plugins {
    id("villages.kotlin-module")
}

// The broker topology and the bridge from the event store to the exchange.
dependencies {
    implementation(project(":application"))
    implementation(project(":domain"))
    implementation(project(":infrastructure-occurrent"))
}
