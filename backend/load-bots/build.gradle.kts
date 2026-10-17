plugins {
    id("villages.kotlin-module")
}

// Simulated players for measuring how many one game server carries. Speaks the protocol and nothing else; its
// socket is the JDK's own. See docs/plans/bot-swarm.md.
dependencies {
    implementation(project(":protocol"))
    // The history of runs is written as JSON lines; the protocol already brings Jackson itself.
    implementation(libs.jackson.module.kotlin)
}

// The bot is played against the server's own frames, which the shared fixtures hold both ends to.
testsRead("contracts/fixtures/frames")

// One bot against a running game server: ./gradlew :load-bots:bot --args=--port=<its port>
tasks.register<JavaExec>("bot") {
    group = "application"
    description = "Plays one simulated player against a running game server."
    classpath = sourceSets["main"].runtimeClasspath
    mainClass = "villages.bots.OneBotKt"
    javaLauncher = javaToolchains.launcherFor { languageVersion = JavaLanguageVersion.of(libs.versions.java.get().toInt()) }
}

// The swarm: starts one game server from the app's own jar and ramps bots at it until it bends.
// ./gradlew :load-bots:swarm, or --args="--stages=100,500 --hold=20" for a short run. See docs/plans/bot-swarm.md.
tasks.register<JavaExec>("swarm") {
    group = "application"
    description = "Measures how many simulated players one game server carries before it bends."
    dependsOn(":app:bootJar")
    classpath = sourceSets["main"].runtimeClasspath
    mainClass = "villages.bots.SwarmMainKt"
    val launcher = javaToolchains.launcherFor { languageVersion = JavaLanguageVersion.of(libs.versions.java.get().toInt()) }
    javaLauncher = launcher
    // Ten thousand sockets and their buffers, which 2 GB was not enough for; the server measured has its own heap.
    maxHeapSize = "6g"
    doFirst {
        systemProperty("villages.java", launcher.get().executablePath.asFile.path)
        systemProperty("villages.jar", rootDir.resolve("app/build/libs/app.jar").path)
        systemProperty("villages.repository", rootDir.parentFile.path)
    }
}
