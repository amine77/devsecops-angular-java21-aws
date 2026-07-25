package com.portfolio.backend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.backend.observability.AppMetrics;
import com.portfolio.backend.security.ClientIpResolver;
import com.portfolio.backend.security.LoginRateLimitFilter;
import com.portfolio.backend.security.LoginRateLimiter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * Câblage du rate limiting de {@code POST /auth/login}.
 *
 * <p>Les composants sont déclarés en {@code @Bean} plutôt qu'en
 * {@code @Component} : ils forment une unité de configuration importable telle
 * quelle dans les tranches de test {@code @WebMvcTest}, qui ne scannent pas les
 * {@code @Component} ordinaires.
 *
 * <p>Réglages par défaut et leur justification :
 * <ul>
 *   <li><b>5 échecs / 15 min</b> — un humain qui a oublié son mot de passe en
 *       essaie 2 ou 3 ; au-delà c'est de l'énumération.</li>
 *   <li><b>20 requêtes / 1 min</b> — largement au-dessus de tout usage
 *       légitime (le formulaire est envoyé une fois), très en dessous de ce
 *       qu'il faut pour saturer le CPU en hashs BCrypt.</li>
 * </ul>
 * Tout est surchargeable par variable d'environnement sans reconstruire l'image.
 */
@Configuration
public class RateLimitConfig {

    @Bean
    public ClientIpResolver clientIpResolver(
        @Value("${app.rate-limit.behind-proxy:true}") boolean behindProxy
    ) {
        return new ClientIpResolver(behindProxy);
    }

    @Bean
    public LoginRateLimiter loginRateLimiter(
        @Value("${app.rate-limit.login.enabled:true}") boolean enabled,
        @Value("${app.rate-limit.login.max-attempts:20}") int maxAttempts,
        @Value("${app.rate-limit.login.attempt-window:PT1M}") Duration attemptWindow,
        @Value("${app.rate-limit.login.max-failures:5}") int maxFailures,
        @Value("${app.rate-limit.login.failure-window:PT15M}") Duration failureWindow
    ) {
        return new LoginRateLimiter(enabled, maxAttempts, attemptWindow, maxFailures, failureWindow);
    }

    @Bean
    public LoginRateLimitFilter loginRateLimitFilter(
        LoginRateLimiter loginRateLimiter,
        ClientIpResolver clientIpResolver,
        AppMetrics appMetrics,
        ObjectMapper objectMapper
    ) {
        return new LoginRateLimitFilter(loginRateLimiter, clientIpResolver, appMetrics, objectMapper);
    }

    /**
     * Empêche Spring Boot d'enregistrer AUSSI le filtre au niveau du conteneur
     * de servlets.
     *
     * <p>Tout bean de type {@code Filter} est automatiquement monté sur
     * {@code /*} par l'auto-configuration. Le filtre s'exécuterait alors deux
     * fois : une fois hors chaîne Spring Security, une fois dedans. Ici c'est
     * la place dans la chaîne de sécurité qui compte, donc on désactive
     * l'enregistrement automatique.
     */
    @Bean
    public FilterRegistrationBean<LoginRateLimitFilter> loginRateLimitFilterRegistration(
        LoginRateLimitFilter filter
    ) {
        FilterRegistrationBean<LoginRateLimitFilter> registration = new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }
}
