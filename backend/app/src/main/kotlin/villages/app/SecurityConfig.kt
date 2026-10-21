package villages.app

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.core.userdetails.UserDetailsService
import org.springframework.security.provisioning.InMemoryUserDetailsManager
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.access.intercept.AuthorizationFilter

/**
 * Spring Security, for what is easy to get wrong: the headers every answer carries, and in time the passwords and
 * Google's and Discord's sign-in. Who a browser is comes from its sign-in's cookie, which the accounts decide, so
 * Spring keeps no session of its own and lets every request through to an endpoint that asks; a request that would
 * change a sign-in from a page that is not ours is refused first, by [OnlyOurPages]. See docs/plans/accounts.md.
 */
@Configuration
class SecurityConfig {
    @Bean
    fun security(http: HttpSecurity): SecurityFilterChain = http
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

    /** Nobody signs in through Spring's own forms, so it is given nobody to sign in as, and makes up no password. */
    @Bean
    fun nobodyBySpringsForms(): UserDetailsService = InMemoryUserDetailsManager()
}
