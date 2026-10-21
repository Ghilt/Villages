package villages.accounts

import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64

/**
 * A secret only the browser holds, and the one form of it the server keeps. A sign-in's cookie carries the secret and
 * the store its SHA-256, so a copy of the store signs nobody in; a mail's link will carry one the same way.
 */
object Secrets {
    private val random = SecureRandom()
    private val text = Base64.getUrlEncoder().withoutPadding()

    /** 256 random bits, as a cookie or a link carries them. */
    fun fresh(): String = ByteArray(BYTES).also(random::nextBytes).let(text::encodeToString)

    /** What the store keeps of [secret]. */
    fun hashOf(secret: String): String =
        text.encodeToString(MessageDigest.getInstance("SHA-256").digest(secret.toByteArray(Charsets.UTF_8)))

    private const val BYTES = 32
}
