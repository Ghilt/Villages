package villages.app

import org.springframework.beans.factory.ObjectProvider
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.accounts.Accounts
import villages.application.SignedIn

/**
 * To whom Adam's instruments are open: to every window while `villages.instruments` is true, as on every tree; to none
 * while it is false; and with `villages.instruments.for` naming emails, only to a window or a request signed in to the
 * verified account of one of them, so a server others play on can keep them open for Adam alone. See decision record
 * 0076 and docs/plans/accounts.md.
 */
class InstrumentsGate(private val open: Boolean, private val only: Set<String>, private val accounts: () -> Accounts) {
    /** Whether they are open only to some, and so asked of each window. */
    val forSome: Boolean get() = open && only.isNotEmpty()

    /** Whether they are open to whoever [signedIn] is. */
    fun openTo(signedIn: SignedIn?): Boolean {
        if (!open) return false
        if (only.isEmpty()) return true
        val record = signedIn?.let { accounts().recordOf(it.player) } ?: return false
        return record.verified && record.email in only
    }
}

@Configuration
class InstrumentsGateConfig {
    @Bean
    fun instrumentsGate(
        @Value("\${villages.instruments:true}") open: Boolean,
        @Value("\${villages.instruments.for:}") only: String,
        accounts: ObjectProvider<Accounts>,
    ): InstrumentsGate = InstrumentsGate(
        open = open,
        only = only.split(',').map { it.trim().lowercase() }.filter { it.isNotEmpty() }.toSet(),
        // Asked lazily, at a window's arrival, because the accounts are told of the gateway's windows ending and so are
        // made after it.
        accounts = { accounts.getObject() },
    )
}
