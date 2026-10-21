package villages.app

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.accounts.AccountStores
import villages.accounts.Accounts
import villages.accounts.InMemoryAccounts
import villages.accounts.MongoAccounts
import villages.accounts.Outbox
import villages.gateway.Gateway
import java.nio.file.Path
import java.time.Clock

/**
 * The accounts, kept where the world is: in memory beside an in-memory world, and in the tree's own MongoDB database
 * beside a world kept there, so a sign-in outlasts a restart exactly when the world does. The same `villages.store`
 * chooses both. See docs/plans/accounts.md and decision record 0092.
 */
@Configuration
class AccountsConfig {
    @Bean(destroyMethod = "close")
    fun accountStores(
        @Value("\${villages.store:memory}") store: String,
        @Value("\${villages.mongo.connection:${StoreConfig.LOCAL_MONGO}}") connection: String,
        @Value("\${villages.mongo.database:}") database: String,
    ): AccountStores = when (store) {
        "mongo" -> MongoAccounts(connection, treeDatabase(database))
        else -> InMemoryAccounts()
    }

    /** Told of every sign-in that ends, the gateway stands its windows down: a window belongs to a live sign-in. */
    @Bean
    fun accounts(stores: AccountStores, clock: Clock, gateway: Gateway, outbox: Outbox): Accounts =
        Accounts(stores, clock, ended = gateway::signInEnded, mailer = outbox)

    /** Where every mail goes in development, which the debug panel shows: nothing here could deliver one. */
    @Bean
    fun outbox(): Outbox = Outbox()

    /** The sign-in's cookie, named for the world this server keeps, which is named for its tree. */
    @Bean
    fun signInCookie(@Value("\${villages.mongo.database:}") database: String): SignInCookie =
        SignInCookie("${treeDatabase(database)}-signin")

    private fun treeDatabase(database: String) = database.ifBlank { databaseFor(Path.of(StoreConfig.CHECKOUT)) }
}
