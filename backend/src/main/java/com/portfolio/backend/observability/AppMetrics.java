package com.portfolio.backend.observability;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.stereotype.Component;

/**
 * Métriques métier custom exposées via Prometheus.
 *
 * <p>Accessibles sur {@code GET /actuator/prometheus}.
 * Scrapées par Prometheus toutes les 15s, visualisées dans Grafana.
 *
 * <p>Métriques disponibles :
 * <ul>
 *   <li>{@code auth_login_success_total}  — logins réussis (compteur)</li>
 *   <li>{@code auth_login_failure_total}  — échecs d'auth (compteur)</li>
 *   <li>{@code http_errors_total}         — erreurs HTTP par code (compteur + tag)</li>
 *   <li>{@code business_operation_duration} — durée opérations clés (timer)</li>
 * </ul>
 *
 * <p>Requêtes PromQL utiles (Grafana) :
 * <pre>
 * // Taux de login par seconde (dernières 5 minutes)
 * rate(auth_login_success_total[5m])
 *
 * // Ratio d'échec d'authentification
 * rate(auth_login_failure_total[5m])
 *   / (rate(auth_login_success_total[5m]) + rate(auth_login_failure_total[5m]))
 *
 * // Erreurs 5xx par seconde
 * rate(http_errors_total{status=~"5.."}[5m])
 * </pre>
 *
 * <p>Convention de nommage Prometheus :
 * {@code <namespace>_<metric>_<unit>} → {@code auth_login_success_total}
 * "_total" est le suffixe standard pour les compteurs.
 */
@Component
public class AppMetrics {

    // =========================================================================
    // Authentification
    // =========================================================================

    /**
     * Nombre de connexions réussies depuis le démarrage de l'application.
     * Permet de calculer le taux de login et de détecter une baisse anormale.
     */
    private final Counter loginSuccess;

    /**
     * Nombre de tentatives d'authentification échouées.
     * Une hausse anormale peut indiquer une attaque brute-force.
     */
    private final Counter loginFailure;

    // =========================================================================
    // Erreurs HTTP
    // =========================================================================

    /**
     * Compteur d'erreurs HTTP taggé par code de statut.
     * Tags : status=4xx ou status=5xx
     * Permet d'alerter sur une hausse des erreurs 500.
     */
    private final MeterRegistry registry;

    // =========================================================================
    // Constructeur — injection MeterRegistry Spring Boot Actuator
    // =========================================================================

    public AppMetrics(MeterRegistry registry) {
        this.registry = registry;

        this.loginSuccess = Counter.builder("auth.login.success")
            .description("Number of successful authentication attempts")
            .tag("result", "success")
            .register(registry);

        this.loginFailure = Counter.builder("auth.login.failure")
            .description("Number of failed authentication attempts — monitor for brute-force")
            .tag("result", "failure")
            .register(registry);
    }

    // =========================================================================
    // Méthodes publiques — appelées depuis AuthService, GlobalExceptionHandler
    // =========================================================================

    /** Incrémenter lors d'une connexion réussie. */
    public void incrementLoginSuccess() {
        loginSuccess.increment();
    }

    /** Incrémenter lors d'un échec d'authentification (mot de passe erroné, token invalide). */
    public void incrementLoginFailure() {
        loginFailure.increment();
    }

    /**
     * Incrémenter le compteur d'erreurs HTTP par code de statut.
     *
     * @param statusCode code HTTP (ex: 400, 401, 403, 404, 500)
     * @param path       chemin de la requête pour le tag
     */
    public void incrementHttpError(int statusCode, String path) {
        Counter.builder("http.errors")
            .description("HTTP error responses by status code")
            .tag("status", String.valueOf(statusCode))
            .tag("status_family", statusCode >= 500 ? "5xx" : statusCode >= 400 ? "4xx" : "other")
            // On ne tag pas le path (cardinalité trop élevée → OOM Prometheus)
            .register(registry)
            .increment();
    }

    /**
     * Créer un Timer pour mesurer la durée d'une opération métier.
     *
     * <p>Usage :
     * <pre>
     *   Timer.Sample sample = metrics.startTimer();
     *   // ... opération ...
     *   metrics.stopTimer(sample, "bcrypt.hash");
     * </pre>
     *
     * @param name nom de la métrique (ex: "bcrypt.hash", "db.query.projects")
     */
    public Timer.Sample startTimer() {
        return Timer.start(registry);
    }

    public void stopTimer(Timer.Sample sample, String operationName) {
        sample.stop(Timer.builder("operation.duration")
            .description("Duration of business operations")
            .tag("operation", operationName)
            .register(registry));
    }
}
