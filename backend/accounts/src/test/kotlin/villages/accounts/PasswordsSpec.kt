package villages.accounts

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.string.shouldStartWith
import java.time.Duration

/** What a password must be, how it is kept, and how many guesses a while allows. */
class PasswordsSpec : StringSpec({
    "a password is kept as its Argon2id hash, which it matches and no other does" {
        val hash = Passwords.hash("a long and quiet river")

        hash shouldStartWith "\$argon2id$"
        hash shouldNotBe "a long and quiet river"
        Passwords.matches("a long and quiet river", hash) shouldBe true
        Passwords.matches("a long and quiet rivet", hash) shouldBe false
        Passwords.matches("a long and quiet river", null) shouldBe false
    }

    "a new password is twelve letters or more, never one of the commonest, a run, or the email" {
        Passwords.problemWith("a long and quiet river", "ada@example.com").shouldBeNull()
        Passwords.problemWith("eleven lett", "ada@example.com") shouldBe "short"
        Passwords.problemWith("x".repeat(129), "ada@example.com") shouldBe "long"
        Passwords.problemWith("Password1234", "ada@example.com") shouldBe "common"
        Passwords.problemWith("aaaaaaaaaaaaaa", "ada@example.com") shouldBe "common"
        Passwords.problemWith("34567890123456", "ada@example.com") shouldBe "common"
        Passwords.problemWith("LKJHGFDSAPOIU", "ada@example.com") shouldBe "common"
        Passwords.problemWith("Ada.Lovelace@example.com", "ada.lovelace@example.com") shouldBe "isTheEmail"
    }

    "an email is kept trimmed and lower-cased, and what is not one is nothing" {
        emailOf("  Ada@Example.COM ") shouldBe "ada@example.com"
        emailOf("ada").shouldBeNull()
        emailOf("ada@example").shouldBeNull()
    }

    "so many tries in a while are allowed, and the while passing allows them again" {
        val clock = HandClock()
        val attempts = Attempts(clock, most = 3, within = Duration.ofMinutes(15))

        repeat(3) { attempts.failed("ada") }
        attempts.allowed("ada") shouldBe false
        attempts.allowed("babbage") shouldBe true
        clock.pass(Duration.ofMinutes(15))
        attempts.allowed("ada") shouldBe true
        repeat(3) { attempts.failed("ada") }
        attempts.forget("ada")
        attempts.allowed("ada") shouldBe true
    }
})
