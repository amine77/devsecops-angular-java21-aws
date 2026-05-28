package com.portfolio.backend.kafka;

import com.portfolio.backend.kafka.event.ProjectCreatedEvent;
import com.portfolio.backend.kafka.event.UserLoginEvent;
import com.portfolio.backend.observability.AppMetrics;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

/**
 * Service de publication d'événements métier vers Kafka.
 *
 * <p>Patterns appliqués :
 * <ul>
 *   <li>Fire-and-forget asynchrone : {@code KafkaTemplate.send()} retourne
 *       un {@code CompletableFuture} — on ne bloque pas la requête HTTP.</li>
 *   <li>Resilience : une failure Kafka ne doit JAMAIS faire échouer le flux
 *       principal. Le service logue en WARN et continue.</li>
 *   <li>Observabilité : chaque publication incrémente un compteur Prometheus
 *       ({@code kafka_events_published_total}) tagué par topic et type.</li>
 * </ul>
 *
 * <p>Clé des messages Kafka = email ou projectId (string).
 * Raison : les messages d'un même utilisateur ou projet sont garantis
 * dans le même partition → ordre préservé pour l'audit trail.
 */
@Service
public class EventPublisher {

    private static final Logger log = LoggerFactory.getLogger(EventPublisher.class);

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final AppMetrics metrics;

    public EventPublisher(KafkaTemplate<String, Object> kafkaTemplate, AppMetrics metrics) {
        this.kafkaTemplate = kafkaTemplate;
        this.metrics = metrics;
    }

    /**
     * Publie un événement de login sur le topic {@code auth-events}.
     *
     * @param event l'événement à publier (login réussi ou échoué)
     */
    public void publishLoginEvent(UserLoginEvent event) {
        Thread.ofVirtual().start(() -> {
            try {
                kafkaTemplate.send(KafkaTopics.AUTH_EVENTS, event.email(), event)
                    .whenComplete((result, ex) -> {
                        if (ex != null) {
                            log.warn("Kafka publish failed [topic={}]: {}",
                                KafkaTopics.AUTH_EVENTS, ex.getMessage());
                        } else {
                            metrics.incrementKafkaPublished(KafkaTopics.AUTH_EVENTS, "UserLoginEvent");
                            log.debug("Event published [topic={}, offset={}]",
                                KafkaTopics.AUTH_EVENTS,
                                result.getRecordMetadata().offset());
                        }
                    });
            } catch (Exception ex) {
                log.warn("Kafka unavailable, event dropped [topic={}]: {}",
                    KafkaTopics.AUTH_EVENTS, ex.getMessage());
            }
        });
    }

    /**
     * Publie un événement de création de projet sur le topic {@code project-events}.
     *
     * @param event l'événement à publier
     */
    public void publishProjectCreatedEvent(ProjectCreatedEvent event) {
        String key = event.projectId().toString();
        Thread.ofVirtual().start(() -> {
            try {
                kafkaTemplate.send(KafkaTopics.PROJECT_EVENTS, key, event)
                    .whenComplete((result, ex) -> {
                        if (ex != null) {
                            log.warn("Kafka publish failed [topic={}]: {}",
                                KafkaTopics.PROJECT_EVENTS, ex.getMessage());
                        } else {
                            metrics.incrementKafkaPublished(KafkaTopics.PROJECT_EVENTS, "ProjectCreatedEvent");
                            log.debug("Event published [topic={}, offset={}]",
                                KafkaTopics.PROJECT_EVENTS,
                                result.getRecordMetadata().offset());
                        }
                    });
            } catch (Exception ex) {
                log.warn("Kafka unavailable, event dropped [topic={}]: {}",
                    KafkaTopics.PROJECT_EVENTS, ex.getMessage());
            }
        });
    }
}
