package villages.app

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.env.Environment
import org.springframework.security.config.oauth2.client.CommonOAuth2Provider
import org.springframework.security.oauth2.client.registration.ClientRegistration
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository
import org.springframework.security.oauth2.core.AuthorizationGrantType
import org.springframework.security.oauth2.core.ClientAuthenticationMethod
import java.nio.file.Files
import java.nio.file.Path
import java.util.Properties

private val oauthLog = LoggerFactory.getLogger("villages.accounts")

/** Google and Discord, the places a browser can sign in through instead of with an email and a password. */
internal val PROVIDERS = listOf("google", "discord")

/**
 * Which of Google and Discord a browser can sign in through, and whose they are: the real ones, as a client
 * registered with each, or a pretend Google and Discord of the game server's own, which ask which made-up identity
 * to be; or none.
 */
class SigningInElsewhere(val registrations: ClientRegistrationRepository?, val providers: List<String>, val pretend: Boolean)

/**
 * Signing in through Google and Discord, as Spring Security's OAuth2 client. Each sends a player back only to an
 * address registered with it, exact to the port, and every tree serves on a port of its own, so the real ones are the
 * main checkout's alone, at 5173, once Adam has registered the two and saved their secrets in
 * `.secrets/oauth.properties` beside the shared `.git`; every other tree, and the main checkout until then, signs in
 * through a pretend Google and Discord while the instruments are open, and through neither while they are closed.
 * `villages.oauth` says otherwise: `real`, `pretend` or `off`. See docs/plans/accounts.md.
 */
@Configuration
class OAuthConfig {
    @Bean
    fun signingInElsewhere(
        environment: Environment,
        @Value("\${villages.oauth:}") asked: String,
        @Value("\${villages.instruments:true}") instrumentsOpen: Boolean,
        @Value("\${villages.mongo.database:}") database: String,
    ): SigningInElsewhere {
        val checkout = Path.of(StoreConfig.CHECKOUT)
        val secrets = savesBesideTheSharedGit(checkout).parent.resolve(".secrets").resolve("oauth.properties")
        val main = database.ifBlank { databaseFor(checkout) } == "villages"
        val how = asked.ifBlank {
            when {
                main && Files.exists(secrets) -> "real"
                instrumentsOpen -> "pretend"
                else -> "off"
            }
        }
        return when (how) {
            "real" -> real(secrets)
            "pretend" -> SigningInElsewhere(pretend(environment), PROVIDERS, pretend = true)
            else -> SigningInElsewhere(null, emptyList(), pretend = false)
        }.also { oauthLog.info("signing in through {}", it.providers.ifEmpty { listOf("nobody else") }.joinToString(" and ") + if (it.pretend) ", pretend" else "") }
    }

    /** The real Google and Discord, each that [secrets] has a client for. */
    private fun real(secrets: Path): SigningInElsewhere {
        val said = Properties().apply { Files.newBufferedReader(secrets).use(::load) }
        val registrations = buildMap {
            said.getProperty("google.client-id")?.let { id ->
                put("google", CommonOAuth2Provider.GOOGLE.getBuilder("google").clientId(id).clientSecret(said.getProperty("google.client-secret")).build())
            }
            said.getProperty("discord.client-id")?.let { id ->
                put("discord", discord(ClientRegistration.withRegistrationId("discord"), id, said.getProperty("discord.client-secret")))
            }
        }
        return SigningInElsewhere(ClientRegistrationRepository { registrations[it] }, registrations.keys.toList(), pretend = false)
    }

    private fun discord(builder: ClientRegistration.Builder, id: String, secret: String?): ClientRegistration = builder
        .clientId(id)
        .clientSecret(secret)
        .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
        .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
        .scope("identify", "email")
        .authorizationUri("https://discord.com/oauth2/authorize")
        .tokenUri("https://discord.com/api/oauth2/token")
        .userInfoUri("https://discord.com/api/users/@me")
        .userNameAttributeName("id")
        .clientName("Discord")
        .build()

    /**
     * The pretend Google and Discord, answered by `PretendProviders` on this game server: the browser is sent to its
     * page through the page's own address, and Spring asks its token and its user of the server itself, on the port it
     * turned out to serve on, which is why each is made when it is first asked for.
     */
    private fun pretend(environment: Environment): ClientRegistrationRepository {
        val made = HashMap<String, ClientRegistration>()
        return ClientRegistrationRepository { id ->
            if (id !in PROVIDERS) return@ClientRegistrationRepository null
            synchronized(made) {
                made.getOrPut(id) {
                    val here = "http://localhost:${environment.getProperty("local.server.port") ?: environment.getProperty("server.port", "8080")}"
                    ClientRegistration.withRegistrationId(id)
                        .clientId("pretend")
                        .clientSecret("pretend")
                        .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_POST)
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
                        .scope("email")
                        .authorizationUri("/pretend/$id/authorize")
                        .tokenUri("$here/pretend/$id/token")
                        .userInfoUri("$here/pretend/$id/userinfo")
                        .userNameAttributeName(if (id == "google") "sub" else "id")
                        .clientName("Pretend ${id.replaceFirstChar(Char::uppercase)}")
                        .build()
                }
            }
        }
    }
}
