plugins {
    `kotlin-dsl`
}

// A plugin used inside a convention plugin has to be on the build's own classpath, as an ordinary
// dependency. This turns a plugin entry from the catalog into that dependency.
fun plugin(provider: Provider<PluginDependency>) =
    provider.map { "${it.pluginId}:${it.pluginId}.gradle.plugin:${it.version}" }

dependencies {
    implementation(plugin(libs.plugins.kotlin.jvm))
}
