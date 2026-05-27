package com.portfolio.backend.kafka;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

/**
 * Configuration Kafka — création déclarative des topics.
 *
 * <p>Spring Boot auto-configure {@code KafkaAdmin} à partir des propriétés
 * {@code spring.kafka.*}. Il suffit de déclarer des beans {@code NewTopic}
 * pour que les topics soient créés au démarrage si absent.
 *
 * <p>Paramètres dev (single-node) :
 * - partitions  = 1 : suffisant pour un seul consumer en dev
 * - replicas    = 1 : impossible d'avoir plus de replicas que de brokers
 *
 * <p>En production (MSK multi-broker) :
 * - partitions  = 3-6 (parallélisme consumer)
 * - replicas    = 3 (haute disponibilité)
 */
@Configuration
public class KafkaConfig {

    /**
     * Topic des événements d'authentification.
     * Retenu par le consumer d'audit pour la traçabilité des connexions.
     */
    @Bean
    public NewTopic authEventsTopic() {
        return TopicBuilder.name(KafkaTopics.AUTH_EVENTS)
            .partitions(1)
            .replicas(1)
            .build();
    }

    /**
     * Topic des événements de projets.
     * Retenu par le consumer d'audit pour l'historique des créations.
     */
    @Bean
    public NewTopic projectEventsTopic() {
        return TopicBuilder.name(KafkaTopics.PROJECT_EVENTS)
            .partitions(1)
            .replicas(1)
            .build();
    }
}
