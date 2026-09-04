// The root has no code of its own. Each module under it applies the `villages.kotlin-module` convention
// from buildSrc and then declares only its allowed dependency edges, which is half of how the layer rules
// are enforced; arch-tests is the other half. Run everything with `./gradlew check`.
