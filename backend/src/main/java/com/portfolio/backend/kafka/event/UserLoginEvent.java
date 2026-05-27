package com.portfolio.backend.kafka.event;

import java.time.Instant;

/**
 * Événement publié sur le topic {@code auth-events} après chaque tentative de login.
 *
 * <p>Java record : immutable, null-safe, equals/hashCode/toString générés.
 * Sérialisé en JSON par Spring Kafka (Jackson) avant publication dans Kafka.
 *
 * <p>Champs :
 * <ul>
 *   <li>{@code userId}    — identifiant de l'utilisateur (null si login échoué)</li>
 *   <li>{@code email}     — email utilisé pour l'authentification</li>
 *   <li>{@code role}      — rôle de l'utilisateur (null si login échoué)</li>
 *   <li>{@code timestamp} — horodatage UTC de l'événement</li>
 *   <li>{@code success}   — true si login réussi, false si échec</li>
 * </ul>
 *
 * <p>Consommé par {@code AuditEventConsumer} qui logue l'événement
 * en JSON structuré (visible dans Grafana/CloudWatch).
 */
public record UserLoginEvent(
    Long userId,
    String email,
    String role,
    Instant timestamp,
    boolean success
) {

    /** Fabrique un événement de login réussi. */
    public static UserLoginEvent success(Long userId, String email, String role) {
        return new UserLoginEvent(userId, email, role, Instant.now(), true);
    }

    /** Fabrique un événement de login échoué. */
    public static UserLoginEvent failure(String email) {
        return new UserLoginEvent(null, email, null, Instant.now(), false);
    }
}
