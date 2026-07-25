package com.portfolio.backend.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.backend.dto.response.ErrorResponse;
import com.portfolio.backend.observability.AppMetrics;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Locale;

/**
 * Refuse les tentatives de connexion excédentaires avec un {@code 429 Too Many Requests}.
 *
 * <p>Placé <b>avant</b> la chaîne d'authentification : une requête refusée ici
 * n'atteint jamais BCrypt, donc ne coûte rien en CPU. C'est tout l'intérêt —
 * un rate limiter branché après le hash protégerait les comptes mais pas le
 * serveur.
 *
 * <p>Le verdict d'authentification est déduit du code de statut après passage
 * dans la chaîne : 401 → échec comptabilisé, 2xx → compteur d'échecs remis à
 * zéro. Cela évite de dupliquer la logique métier de {@code AuthService} et
 * fonctionne quel que soit le chemin qui produit le 401 (exception métier ou
 * {@code AuthenticationEntryPoint}).
 *
 * <p>Ce filtre ferme la boucle avec l'alarme CloudWatch
 * {@code portfolio-auth-brute-force} : jusqu'ici l'alarme <i>constatait</i>
 * une rafale d'échecs pendant que l'attaque se poursuivait sans entrave.
 */
public class LoginRateLimitFilter extends OncePerRequestFilter {

    private static final String LOGIN_PATH = "/auth/login";

    private final LoginRateLimiter rateLimiter;
    private final ClientIpResolver ipResolver;
    private final AppMetrics metrics;
    private final ObjectMapper objectMapper;

    public LoginRateLimitFilter(
        LoginRateLimiter rateLimiter,
        ClientIpResolver ipResolver,
        AppMetrics metrics,
        ObjectMapper objectMapper
    ) {
        this.rateLimiter = rateLimiter;
        this.ipResolver = ipResolver;
        this.metrics = metrics;
        this.objectMapper = objectMapper;
    }

    /**
     * N'intercepte que {@code POST /auth/login}.
     *
     * <p>Le slash final est normalisé : sans cela, {@code /auth/login/} serait
     * une porte de contournement triviale si le routage venait à l'accepter.
     */
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!"POST".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String path = request.getRequestURI();
        if (path == null) {
            return true;
        }
        if (path.length() > 1 && path.endsWith("/")) {
            path = path.substring(0, path.length() - 1);
        }
        return !LOGIN_PATH.equals(path);
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {

        String clientIp = ipResolver.resolve(request);
        LoginRateLimiter.Decision decision = rateLimiter.check(clientIp);

        if (decision.blocked()) {
            reject(request, response, decision);
            return;
        }

        filterChain.doFilter(request, response);

        // Volontairement pas dans un finally : si une exception traverse la
        // chaîne, le statut vaut encore 200 et on remettrait à tort le
        // compteur d'échecs à zéro.
        int status = response.getStatus();
        if (status == HttpStatus.UNAUTHORIZED.value()) {
            rateLimiter.recordFailure(clientIp);
        } else if (status >= HttpStatus.OK.value() && status < HttpStatus.MULTIPLE_CHOICES.value()) {
            rateLimiter.recordSuccess(clientIp);
        }
    }

    /**
     * Écrit un 429 au même format que les autres erreurs de l'API.
     *
     * <p>{@code Retry-After} est renseigné : un client légitime (ou un outil de
     * test de charge) sait quand réessayer au lieu d'insister à l'aveugle.
     */
    private void reject(
        HttpServletRequest request,
        HttpServletResponse response,
        LoginRateLimiter.Decision decision
    ) throws IOException {

        metrics.incrementLoginRateLimited(decision.outcome().name().toLowerCase(Locale.ROOT));

        String message = decision.outcome() == LoginRateLimiter.Outcome.LOCKED_OUT
            ? "Trop de tentatives de connexion échouées. Réessayez dans "
                + decision.retryAfterSeconds() + " secondes."
            : "Trop de requêtes. Réessayez dans " + decision.retryAfterSeconds() + " secondes.";

        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType("application/json;charset=UTF-8");
        response.setHeader(HttpHeaders.RETRY_AFTER, String.valueOf(decision.retryAfterSeconds()));

        objectMapper.writeValue(response.getWriter(), ErrorResponse.of(
            HttpStatus.TOO_MANY_REQUESTS.value(),
            "Too Many Requests",
            message,
            request.getRequestURI()
        ));
    }
}
