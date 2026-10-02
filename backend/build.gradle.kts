// The root has no code of its own. Each module under it applies the `villages.kotlin-module` convention
// from buildSrc and then declares only its allowed dependency edges, which is half of how the layer rules
// are enforced (arch-tests is the other half), and the files outside it that its tests read. Run
// everything with `./gradlew check`.
