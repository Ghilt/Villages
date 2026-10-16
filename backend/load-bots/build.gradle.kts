plugins {
    id("villages.kotlin-module")
}

// Simulated players for measuring how many one game server carries. Speaks the protocol and nothing else; its
// socket is the JDK's own. See docs/plans/bot-swarm.md.
dependencies {
    implementation(project(":protocol"))
}

// The bot is played against the server's own frames, which the shared fixtures hold both ends to.
testsRead("contracts/fixtures/frames")

// One bot against a running game server: ./gradlew :load-bots:bot --args=--port=<its port>
tasks.register<JavaExec>("bot") {
    group = "application"
    description = "Plays one simulated player against a running game server."
    classpath = sourceSets["main"].runtimeClasspath
    mainClass = "villages.bots.OneBotKt"
    javaLauncher = javaToolchains.launcherFor { languageVersion = JavaLanguageVersion.of(21) }
}
