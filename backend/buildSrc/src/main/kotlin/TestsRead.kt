import org.gradle.api.Project
import org.gradle.api.provider.SetProperty

/**
 * Files outside a module that its tests open for themselves, named from the repository root. Gradle cannot see
 * a file a test opens, so the `villages.kotlin-module` convention makes each of these an input of the tests;
 * without that, a change to one of them alone would leave the tests up to date.
 */
abstract class TestsRead {
    abstract val paths: SetProperty<String>
}

fun Project.testsRead(vararg fromTheRepositoryRoot: String) {
    extensions.getByType(TestsRead::class.java).paths.addAll(*fromTheRepositoryRoot)
}
