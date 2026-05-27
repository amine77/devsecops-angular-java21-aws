package com.portfolio.backend.kafka;

/**
 * Constantes des noms de topics Kafka utilisés dans l'application.
 *
 * <p>Centraliser les noms évite les fautes de frappe et facilite
 * les refactorings (un seul endroit à modifier).
 */
public final class KafkaTopics {

    /** Événements d'authentification : login réussi et échec. */
    public static final String AUTH_EVENTS = "auth-events";

    /** Événements de gestion des projets : création. */
    public static final String PROJECT_EVENTS = "project-events";

    private KafkaTopics() {
        // Classe utilitaire — pas d'instanciation
    }
}
