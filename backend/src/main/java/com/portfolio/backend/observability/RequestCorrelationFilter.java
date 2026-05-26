package com.portfolio.backend.observability;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.UUID;

/**
 * Filtre HTTP de corrélation des requêtes.
 *
 * <p>Fonctionnement :
 * 1. Lit le header {@code X-Request-Id} s'il est fourni par le client ou un proxy.
 *    Sinon, génère un UUID aléatoire.
 * 2. Place le requestId dans le MDC (Mapped Diagnostic Context) de SLF4J.
 *    Tous les logs émis pendant cette requête auront automatiquement le requestId.
 * 3. Retourne le requestId dans le header de réponse {@code X-Request-Id}.
 *    Le client peut ainsi corréler sa requête avec les logs serveur.
 * 4. Nettoie le MDC après la requête (OBLIGATOIRE avec les Virtual Threads de Java 21).
 *
 * <p>Avec les logs JSON en prod, chaque ligne de log contient :
 * <pre>
 * {
 *   "@timestamp": "2026-01-15T10:23:45.123Z",
 *   "level": "INFO",
 *   "message": "User logged in",
 *   "requestId": "550e8400-e29b-41d4-a716-446655440000",  ← traçabilité
 *   "httpMethod": "POST",
 *   "httpPath": "/auth/login",
 *   "userId": "admin@portfolio.dev"
 * }
 * </pre>
 *
 * <p>Requête CloudWatch Logs Insights pour tracer une requête complète :
 * <pre>
 *   fields @timestamp, level, message, requestId
 *   | filter requestId = "550e8400-..."
 *   | sort @timestamp asc
 * </pre>
 */
@Component
@Order(1) // S'exécute en premier, avant Spring Security et les controllers
public class RequestCorrelationFilter implements Filter {

    public static final String REQUEST_ID_HEADER = "X-Request-Id";
    public static final String MDC_REQUEST_ID    = "requestId";
    public static final String MDC_HTTP_METHOD   = "httpMethod";
    public static final String MDC_HTTP_PATH     = "httpPath";
    public static final String MDC_USER_ID       = "userId";

    @Override
    public void doFilter(
        ServletRequest servletRequest,
        ServletResponse servletResponse,
        FilterChain chain
    ) throws IOException, ServletException {

        HttpServletRequest  request  = (HttpServletRequest)  servletRequest;
        HttpServletResponse response = (HttpServletResponse) servletResponse;

        // Récupérer ou générer le requestId
        String requestId = request.getHeader(REQUEST_ID_HEADER);
        if (requestId == null || requestId.isBlank()) {
            requestId = UUID.randomUUID().toString();
        }

        // Peupler le MDC — visible dans TOUS les logs de cette requête
        MDC.put(MDC_REQUEST_ID,  requestId);
        MDC.put(MDC_HTTP_METHOD, request.getMethod());
        MDC.put(MDC_HTTP_PATH,   request.getRequestURI());

        // Propager le requestId au client pour la corrélation côté frontend
        response.setHeader(REQUEST_ID_HEADER, requestId);

        try {
            chain.doFilter(request, response);
        } finally {
            // IMPORTANT : le MDC est thread-local.
            // Avec Virtual Threads (Java 21), un thread peut être réutilisé
            // pour une nouvelle requête → toujours nettoyer après usage.
            MDC.clear();
        }
    }
}
