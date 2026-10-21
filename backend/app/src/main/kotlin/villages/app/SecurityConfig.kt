package villages.app

import org.springframework.boot.web.servlet.ServletContextInitializer
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.core.userdetails.UserDetailsService
import org.springframework.security.provisioning.InMemoryUserDetailsManager
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.access.intercept.AuthorizationFilter
import villages.accounts.Accounts

/**
 * Spring Security, for what is easy to get wrong: the headers every answer carries, and signing in through Google
 * and Discord as a client of theirs. Who a browser is comes from its sign-in's cookie, which the accounts decide, so
 * Spring keeps no session of its own and lets every request through to an endpoint that asks; a request that would
 * change a sign-in from a page that is not ours is refused first, by [OnlyOurPages]. See docs/plans/accounts.md.
 */
@Configuration
class SecurityConfig {
    @Bean
    fun security(http: HttpSecurity, elsewhere: SigningInElsewhere, accounts: Accounts, cookie: SignInCookie): SecurityFilterChain = http
        .apply {
            // Google and Discord, when there are any to sign in through: Spring's client, from /oauth2/authorization/
            // google to /login/oauth2/code/google, then the accounts. See OAuthConfig.
            elsewhere.registrations?.let { registrations ->
                val back = SignedInElsewhere(accounts, cookie)
                oauth2Login { it.clientRegistrationRepository(registrations).loginPage("/").successHandler(back).failureHandler(back) }
            }
        }
        .authorizeHttpRequests { it.anyRequest().permitAll() }
        // Forged requests are refused by the origin a browser names, which is OnlyOurPages, rather than by a token.
        .csrf { it.disable() }
        .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
        .formLogin { it.disable() }
        .httpBasic { it.disable() }
        .logout { it.disable() }
        .requestCache { it.disable() }
        .addFilterBefore(OnlyOurPages(), AuthorizationFilter::class.java)
        .build()

    /**
     * The session Spring keeps a Google or Discord asking in, between sending the player there and their coming back,
     * named for the tree as the sign-in's cookie is, so two trees asking at once on this machine keep theirs apart, and
     * ended a quarter of an hour on, which is longer than anybody takes to choose.
     */
    @Bean
    fun theAskingsSession(cookie: SignInCookie): ServletContextInitializer = ServletContextInitializer { context ->
        context.sessionCookieConfig.name = cookie.name.replace("-signin", "-asking")
        context.setSessionTimeout(15)
    }

    /** Nobody signs in through Spring's own forms, so it is given nobody to sign in as, and makes up no password. */
    @Bean
    fun nobodyBySpringsForms(): UserDetailsService = InMemoryUserDetailsManager()
}
