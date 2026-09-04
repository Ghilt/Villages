plugins {
    id("villages.kotlin-module")
}

// Use cases and the ports they need. Depends on the domain and on nothing else; infrastructure implements
// the ports from the other side.
dependencies {
    implementation(project(":domain"))
}
