package villages.app

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.accounts.AccountStores
import villages.accounts.Accounts
import villages.accounts.InMemoryAccounts
import villages.accounts.MongoAccounts
import villages.accounts.Outbox
import villages.gateway.Gateway
import villages.gateway.signInEnded
import java.nio.file.Path
import java.time.Clock
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

private val sweepLog = LoggerFactory.getLogger("villages.accounts")

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

    /**
     * The sweep of the sign-ins, every five minutes: each with a window open used now, and every other past its end
     * ended, so none lingers in the store and a window open all day keeps its sign-in.
     */
    @Bean(destroyMethod = "close")
    fun signInSweep(accounts: Accounts, socket: GatewaySocket): AutoCloseable {
        val every = Executors.newSingleThreadScheduledExecutor { Thread(it, "villages-sign-in-sweep").apply { isDaemon = true } }
        val sweep = Runnable {
            // A sweep that throws would never be run again, so what it threw is said and the next one runs all the same.
            runCatching { accounts.signIns.sweep(socket.signInsInUse()) }.onFailure { sweepLog.warn("the sweep of the sign-ins failed", it) }
        }
        every.scheduleWithFixedDelay(sweep, 1, 5, TimeUnit.MINUTES)
        return AutoCloseable { every.shutdownNow() }
    }

    /** Where every mail goes in development, which the debug panel shows: nothing here could deliver one. */
    @Bean
    fun outbox(): Outbox = Outbox()

    /** The sign-in's cookie, named for the world this server keeps, which is named for its tree. */
    @Bean
    fun signInCookie(@Value("\${villages.mongo.database:}") database: String): SignInCookie =
        SignInCookie("${treeDatabase(database)}-signin")

    private fun treeDatabase(database: String) = database.ifBlank { databaseFor(Path.of(StoreConfig.CHECKOUT)) }
}
