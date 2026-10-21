plugins {
    id("villages.kotlin-module")
}

// Who a browser is signed in as, and the players behind it: sign-ins kept by the hash of their secret, and each
// player's record, in memory or in the tree's own MongoDB beside the events. Not the world's history, so nothing here
// is an event; the game knows a player only by the id the application's `SignedInPlayers` hands it. See
// docs/plans/accounts.md.
dependencies {
    implementation(project(":domain"))
    implementation(project(":application"))
    implementation(platform(libs.spring.boot.dependencies))
    implementation(libs.mongodb.driver.sync)
    // Passwords are hashed with Argon2id, Spring Security's, on BouncyCastle's implementation.
    implementation(libs.spring.security.crypto)
    runtimeOnly(libs.bouncycastle.provider)
    runtimeOnly(libs.commons.logging)
    runtimeOnly(libs.spring.core)

    // A MongoDB of the test's own, thrown away after it, for the specs that say they need Docker.
    testImplementation(libs.testcontainers.mongodb)
}
