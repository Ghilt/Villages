package villages.app

import villages.accounts.Keeping
import villages.accounts.PlayerRecord
import villages.accounts.Settings
import villages.accounts.SignIn
import villages.domain.HouseId

/**
 * Who a browser is, as `/auth/me` answers it: a player and their house, whether they are a guest or the account's
 * email and whether it is verified, the sign-in, and their settings; or nobody at all. Times are milliseconds.
 */
data class Me(
    val player: String?,
    val house: String?,
    val guest: Boolean,
    val email: String?,
    val verified: Boolean,
    /** The places this account signs in through besides its email: google, discord. */
    val through: List<String>,
    val signIn: SignInView?,
    val settings: SettingsView,
) {
    companion object {
        val NOBODY = Me(
            player = null,
            house = null,
            guest = false,
            email = null,
            verified = false,
            through = emptyList(),
            signIn = null,
            settings = SettingsView.of(Settings()),
        )

        fun of(signIn: SignIn, record: PlayerRecord?) = Me(
            player = signIn.player.value.toString(),
            house = HouseId.of(signIn.player).value.toString(),
            guest = record?.guest ?: true,
            email = record?.email,
            verified = record?.verified ?: false,
            through = record?.logins.orEmpty().map { it.provider },
            signIn = SignInView(
                id = signIn.id.value.toString(),
                keeping = signIn.keeping.said,
                browser = signIn.browser,
                ends = signIn.ends.toEpochMilli(),
            ),
            settings = SettingsView.of(record?.settings ?: Settings()),
        )
    }
}

/** A player's settings, as the page is told them and sends them back. */
data class SettingsView(val motion: String, val language: String) {
    companion object {
        fun of(settings: Settings) = SettingsView(settings.motion, settings.language)
    }
}

/** A sign-in, as the page is told of it: how it is kept, in the page's words, and when it ends unless used again. */
data class SignInView(val id: String, val keeping: String, val browser: String, val ends: Long)

/** How a [Keeping] is said on the page's side of `/auth`. */
internal val Keeping.said: String
    get() = when (this) {
        Keeping.REMEMBERED -> "remembered"
        Keeping.FOR_NOW -> "forNow"
        Keeping.GUEST -> "guest"
    }

/** A refusal, as every endpoint under `/auth` says one: a code the page has words for. */
internal fun refused(why: String) = mapOf("refused" to why)
