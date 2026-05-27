package com.portfolio.backend.kafka;

import com.portfolio.backend.kafka.event.ProjectCreatedEvent;
import com.portfolio.backend.kafka.event.UserLoginEvent;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Consumer Kafka d'audit — reçoit les événements métier et les logue en JSON structuré.
 *
 * <p>Responsabilités :
 * - Consommer les événements des topics {@code auth-events} et {@code project-events}
 * - Enrichir le MDC Logback avec les métadonnées Kafka ({@code kafkaTopic}, {@code kafkaOffset})
 * - Produire des logs d'audit JSON structurés lisibles dans Grafana / CloudWatch
 *
 * <p>Pattern MDC (Mapped Diagnostic Context) :
 * Tous les champs ajoutés au MDC apparaissent automatiquement dans le JSON de log.
 * Exemple en production :
 * <pre>
 * {
 *   "@timestamp": "2025-01-15T10:30:00Z",
 *   "level": "INFO",
 *   "logger": "AuditEventConsumer",
 *   "message": "AUDIT: login réussi",
 *   "kafkaTopic": "auth-events",
 *   "kafkaOffset": "42",
 *   "userId": "admin@portfolio.dev"
 * }
 * </pre>
 *
 * <p>Le bloc try/finally garantit le nettoyage du MDC même en cas d'exception,
 * évitant la pollution de contexte entre les threads.
 */
@Component
public class AuditEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(AuditEventConsumer.class);

    private static final String MDC_TOPIC = "kafkaTopic";
    private static final String MDC_OFFSET = "kafkaOffset";
    private static final String MDC_USER = "userId";

    /**
     * Consomme les événements du topic {@code auth-events}.
     *
     * @param event  événement désérialisé (login réussi ou échoué)
     * @param record métadonnées Kafka (topic, partition, offset, timestamp)
     */
    @KafkaListener(topics = KafkaTopics.AUTH_EVENTS, groupId = "portfolio-audit")
    public void consumeAuthEvent(
        UserLoginEvent event,
        ConsumerRecord<String, UserLoginEvent> record
    ) {
        MDC.put(MDC_TOPIC, record.topic());
        MDC.put(MDC_OFFSET, String.valueOf(record.offset()));
        MDC.put(MDC_USER, event.email());
        try {
            if (event.success()) {
                log.info("AUDIT: login réussi — email={}, role={}, ts={}",
                    event.email(), event.role(), event.timestamp());
            } else {
                log.warn("AUDIT: login échoué — email={}, ts={}",
                    event.email(), event.timestamp());
            }
        } finally {
            MDC.remove(MDC_TOPIC);
            MDC.remove(MDC_OFFSET);
            MDC.remove(MDC_USER);
        }
    }

    /**
     * Consomme les événements du topic {@code project-events}.
     *
     * @param event  événement désérialisé (projet créé)
     * @param record métadonnées Kafka
     */
    @KafkaListener(topics = KafkaTopics.PROJECT_EVENTS, groupId = "portfolio-audit")
    public void consumeProjectEvent(
        ProjectCreatedEvent event,
        ConsumerRecord<String, ProjectCreatedEvent> record
    ) {
        MDC.put(MDC_TOPIC, record.topic());
        MDC.put(MDC_OFFSET, String.valueOf(record.offset()));
        MDC.put(MDC_USER, event.createdBy());
        try {
            log.info("AUDIT: projet créé — id={}, title=\"{}\", author={}, ts={}",
                event.projectId(), event.title(), event.createdBy(), event.timestamp());
        } finally {
            MDC.remove(MDC_TOPIC);
            MDC.remove(MDC_OFFSET);
            MDC.remove(MDC_USER);
        }
    }
}
