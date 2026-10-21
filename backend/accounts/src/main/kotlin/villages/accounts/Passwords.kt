package villages.accounts

import org.springframework.security.crypto.argon2.Argon2PasswordEncoder

/**
 * How a password is kept, and what a new one must be. Kept as its Argon2id hash, Spring Security's, salted and slow on
 * purpose, so a copy of the store gives a guesser a few tries a second rather than billions; never written anywhere
 * as it was typed. A new one is twelve letters or more, with no rule about symbols, because length is what makes a
 * password hard to guess and rules about symbols make it hard to remember; and never one of the commonest. See
 * docs/plans/accounts.md.
 */
object Passwords {
    private val argon2 = Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8()

    /** A hash nobody's password matches, compared against when the email is nobody's, so neither answer is quicker. */
    private val nobodys: String by lazy { argon2.encode(Secrets.fresh())!! }

    private val common: Set<String> by lazy {
        Passwords::class.java.getResource("common-passwords.txt")!!.readText().lines()
            .map { it.trim() }
            .filter { it.isNotEmpty() && !it.startsWith("#") }
            .toSet()
    }

    fun hash(password: String): String = argon2.encode(password)!!

    /** Whether [password] is the one [hash] keeps; with no hash, a comparison as slow as a real one, and false. */
    fun matches(password: String, hash: String?): Boolean =
        if (hash == null) argon2.matches(password, nobodys).let { false } else argon2.matches(password, hash)

    /** What is wrong with [password] as a new one for [email], as the page has words for it, or null. */
    fun problemWith(password: String, email: String): String? {
        val folded = password.lowercase()
        return when {
            password.length < SHORTEST -> "short"
            password.length > LONGEST -> "long"
            folded in common || password.all { it == password[0] } || isARun(folded) -> "common"
            folded == email.lowercase() || folded == email.substringBefore('@').lowercase() -> "isTheEmail"
            else -> null
        }
    }

    /** A run of the digits or of the keyboard, forwards or back: 123456789012, qwertyuiopas, 0987654321. */
    private fun isARun(folded: String): Boolean = RUNS.any { run -> folded in run || folded in run.reversed() }

    private const val SHORTEST = 12

    /** Long enough for any phrase, and short enough that hashing one is no way to tire the server. */
    private const val LONGEST = 128

    private val RUNS = listOf("1234567890".repeat(4), "qwertyuiopasdfghjklzxcvbnm".repeat(2), "abcdefghijklmnopqrstuvwxyz")
}

/** An email as one account is kept under: trimmed and lower-cased, or null when it is not an email at all. */
fun emailOf(typed: String): String? {
    val email = typed.trim().lowercase()
    return email.takeIf { it.length <= LONGEST_EMAIL && EMAIL.matches(it) }
}

private val EMAIL = Regex("""[^\s@]+@[^\s@]+\.[^\s@]+""")

private const val LONGEST_EMAIL = 254
