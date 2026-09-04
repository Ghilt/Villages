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
}
