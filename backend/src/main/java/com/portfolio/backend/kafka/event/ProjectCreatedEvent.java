package com.portfolio.backend.kafka.event;

import java.time.Instant;

/**
 * Événement publié sur le topic {@code project-events} après la création d'un projet.
 *
 * <p>Java record : immutable, null-safe, equals/hashCode/toString générés.
 * Sérialisé en JSON par Spring Kafka (Jackson) avant publication dans Kafka.
 *
 * <p>Champs :
 * <ul>
 *   <li>{@code projectId}   — identifiant du projet créé</li>
 *   <li>{@code title}       — titre du projet</li>
 *   <li>{@code createdBy}   — email de l'administrateur créateur</li>
 *   <li>{@code timestamp}   — horodatage UTC de la création</li>
 * </ul>
 *
 * <p>Consommé par {@code AuditEventConsumer} qui logue l'événement
 * en JSON structuré pour l'audit trail.
 */
public record ProjectCreatedEvent(
    Long projectId,
    String title,
    String createdBy,
    Instant timestamp
) {

    /** Fabrique un événement de création de projet. */
    public static ProjectCreatedEvent of(Long projectId, String title, String createdBy) {
        return new ProjectCreatedEvent(projectId, title, createdBy, Instant.now());
    }
}
