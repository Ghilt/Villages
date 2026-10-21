package villages.app

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.core.Authentication
import org.springframework.security.core.AuthenticationException
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken
import org.springframework.security.web.authentication.AuthenticationFailureHandler
import org.springframework.security.web.authentication.AuthenticationSuccessHandler
import villages.accounts.Accounts
import villages.accounts.Asking
import villages.accounts.Login
import villages.accounts.browserOf

/**
 * A player back from Google or Discord, signed in there: their identity, its email and whether that provider has
 * verified it, read in each one's own words, made this browser's sign-in by the accounts' rules for joining one to an
 * account, and sent back to the game. Spring keeps nothing of it: the session it held the asking in is ended, and the
 * cookie is the sign-in\'s. See docs/plans/accounts.md.
 */
class SignedInElsewhere(private val accounts: Accounts, private val cookie: SignInCookie) :
    AuthenticationSuccessHandler,
    AuthenticationFailureHandler {
    override fun onAuthenticationSuccess(request: HttpServletRequest, response: HttpServletResponse, authentication: Authentication) {
        val token = authentication as OAuth2AuthenticationToken
        val provider = token.authorizedClientRegistrationId
        val said = token.principal.attributes
        val email = said["email"] as? String
        val verified = (if (provider == "google") said["email_verified"] else said["verified"]) == true
        val current = cookie.read(request)?.let(accounts.signIns::find)
        val asking = Asking(browserOf(request.getHeader("User-Agent")), request.remoteAddr, "")
        val begun = accounts.signInThrough(Login(provider, token.principal.name), email, verified, current, asking)
        cookie.write(response, request, begun.secret, begun.signIn.keeping)
        request.getSession(false)?.invalidate()
        response.sendRedirect("/")
    }

    /** Refused there, or put away: back to the game as whoever the browser was, which says so. */
    override fun onAuthenticationFailure(request: HttpServletRequest, response: HttpServletResponse, exception: AuthenticationException) {
        request.getSession(false)?.invalidate()
        response.sendRedirect("/?signedIn=refused")
    }
}
