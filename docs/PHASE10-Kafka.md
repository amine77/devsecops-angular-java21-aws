# Phase 10 — Apache Kafka KRaft (Messaging asynchrone)

## Vue d'ensemble

| Aspect | Détail |
|--------|--------|
| Mode | KRaft — sans ZooKeeper (Kafka 3.x natif) |
| Topics | `auth-events`, `project-events` |
| Producteur | `EventPublisher` — fire-and-forget asynchrone |
| Consommateur | `AuditEventConsumer` — log de l'audit trail |
| Dashboard Grafana | "Kafka — Événements & Métriques" |
| Port broker | 9092 (interne) + 9093 (contrôleur KRaft) |
| UI web | Kafka UI sur http://localhost:8090 |

---

## 1. Architecture

### Flux d'événements

```
HTTP Request
    │
    ▼
AuthController / ProjectController
    │  valide + délègue au Service
    ▼
AuthService / ProjectService
    │  logique métier (sync)
    │  ──────────────────────────────────────────────────
    │  EventPublisher.publishLoginEvent()
    │  EventPublisher.publishProjectCreatedEvent()
    │     │  fire-and-forget (CompletableFuture)
    │     │  la réponse HTTP N'attend PAS Kafka
    ▼     ▼
HTTP Response   Kafka Broker (KRaft)
                    │
                    ├── topic: auth-events
                    │     └── AuditEventConsumer → log JSON
                    │
                    └── topic: project-events
                          └── AuditEventConsumer → log JSON
```

### Garantie d'ordre par partition

```
auth-events topic
  Partition 0 : messages clé="admin@portfolio.dev"
  Partition 1 : messages clé="user@portfolio.dev"
  ...
```

La clé du message = email de l'utilisateur (auth) ou projectId (projets). Tous les événements d'un même utilisateur arrivent dans le même partition → ordre temporel garanti.

---

## 2. Topics

### `auth-events`

Publié par : `AuthService.login()` après chaque tentative de connexion.

```json
{
  "email": "admin@portfolio.dev",
  "success": true,
  "timestamp": "2026-05-28T10:23:45.123Z",
  "ipAddress": "192.168.1.1"
}
```

### `project-events`

Publié par : `ProjectService.createProject()` après chaque création.

```json
{
  "projectId": 42,
  "title": "Portfolio DevSecOps",
  "createdBy": "admin@portfolio.dev",
  "timestamp": "2026-05-28T10:25:00.000Z"
}
```

---

## 3. EventPublisher — Pattern fire-and-forget

```java
public void publishLoginEvent(UserLoginEvent event) {
    kafkaTemplate.send(KafkaTopics.AUTH_EVENTS, event.email(), event)
        .whenComplete((result, ex) -> {
            if (ex != null) {
                // Kafka down → WARN uniquement, la requête HTTP est déjà répondue
                log.warn("Kafka publish failed [topic={}]: {}", AUTH_EVENTS, ex.getMessage());
            } else {
                metrics.incrementKafkaPublished(AUTH_EVENTS, "UserLoginEvent");
            }
        });
}
```

**Principe de résilience** : une panne Kafka ne fait pas échouer le login. L'événement est perdu (acceptable pour un audit trail) mais l'utilisateur reçoit son token.

---

## 4. Configuration KRaft (sans ZooKeeper)

### `docker-compose.kafka.yml` — overlay optionnel

```yaml
kafka:
  image: bitnami/kafka:3.6
  environment:
    KAFKA_CFG_NODE_ID: 1
    KAFKA_CFG_PROCESS_ROLES: broker,controller   # KRaft : même nœud = broker + controller
    KAFKA_CFG_CONTROLLER_QUORUM_VOTERS: 1@kafka:9093
    KAFKA_CFG_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093,EXTERNAL://:9094
    KAFKA_CFG_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092,EXTERNAL://localhost:9094
    KAFKA_CFG_AUTO_CREATE_TOPICS_ENABLE: "true"
```

**Avantage de KRaft** : en mode dev, plus besoin d'un container ZooKeeper séparé. Le broker est autonome — démarrage ~5s au lieu de ~15s avec ZooKeeper.

### Démarrage

```powershell
# Stack de base (Postgres + Redis + Prometheus + Grafana)
docker compose -f docker/docker-compose.dev-stack.yml up -d

# Overlay Kafka optionnel
docker compose -f docker/docker-compose.dev-stack.yml -f docker/docker-compose.kafka.yml up -d
```

---

## 5. Configuration Spring Boot

### `application.properties` — extraits Kafka

```properties
# Broker (surchargeable via KAFKA_BOOTSTRAP_SERVERS)
spring.kafka.bootstrap-servers=${KAFKA_BOOTSTRAP_SERVERS:localhost:9092}

# Producer — sérialisation JSON avec __TypeId__ header
spring.kafka.producer.value-serializer=\
  org.springframework.kafka.support.serializer.JsonSerializer
spring.kafka.producer.acks=1   # Leader acknowledges (pas besoin de tous les réplicas en dev)

# Consumer — désérialisation typée par __TypeId__
spring.kafka.consumer.value-deserializer=\
  org.springframework.kafka.support.serializer.JsonDeserializer
spring.kafka.consumer.properties.spring.json.trusted.packages=\
  com.portfolio.backend.kafka.event
```

### Désactivation pour les tests CI (Gatling, Cypress, ZAP)

Quand Kafka n'est pas démarré, les workflows CI le désactivent :

```bash
mvn spring-boot:run \
  -Dspring.kafka.listener.auto-startup=false \
  -Dspring.kafka.admin.auto-create=false
```

---

## 6. Dashboard Grafana Kafka

**Accès :** http://localhost:3000 → onglet "Kafka — Événements & Métriques"

| Panel | Métrique Prometheus |
|-------|---------------------|
| Taux de publication (events/min) | `rate(kafka_events_published_total[1m])` |
| Events par topic | `kafka_events_published_total` tagué `{topic}` |
| Events par type | `kafka_events_published_total` tagué `{event_type}` |
| Erreurs de publication | `rate(kafka_publish_errors_total[1m])` |

La métrique `kafka_events_published_total` est incrémentée par `EventPublisher` uniquement sur succès — une failure Kafka est visible via l'absence d'incrémentation.

---

## 7. Kafka UI

**Accès :** http://localhost:8090 (container `kafka-ui`)

Interface web Provectus Kafka UI — permet de :
- Lister les topics et leur contenu
- Voir les consumer groups et leur lag
- Publier des messages manuellement (tests)
- Voir les offsets en temps réel

---

## 8. Décisions techniques

### Pourquoi KRaft et pas Zookeeper ?

KRaft (Kafka Raft) est le mode natif Kafka depuis la version 3.x. ZooKeeper est déprécié et sera supprimé dans Kafka 4.0. Adopter KRaft en dev maintenant évite une migration future et réduit l'overhead d'un container supplémentaire.

### Pourquoi `acks=1` en dev ?

`acks=all` garantit que tous les réplicas ont reçu le message avant acquittement — inutile avec un seul broker dev. `acks=1` (leader seul) est suffisant et plus rapide en développement local.

### Pourquoi fire-and-forget et pas une transaction Kafka ?

Les événements Kafka ici sont des **notifications d'audit** — leur perte est acceptable et non critique. Une transaction Kafka (exactly-once semantics) alourdirait la latence de chaque login de 50-100ms inutilement. Les vraies garanties sont dans PostgreSQL (données persistées).

---

## 9. Fichiers créés

| Fichier | Description |
|---------|-------------|
| `backend/.../kafka/KafkaTopics.java` | Constantes des noms de topics |
| `backend/.../kafka/KafkaConfig.java` | Configuration des topics (partitions, réplication) |
| `backend/.../kafka/EventPublisher.java` | Service de publication (fire-and-forget) |
| `backend/.../kafka/AuditEventConsumer.java` | Consumer pour l'audit trail |
| `backend/.../kafka/event/UserLoginEvent.java` | Record Java — événement login |
| `backend/.../kafka/event/ProjectCreatedEvent.java` | Record Java — événement création projet |
| `docker/docker-compose.kafka.yml` | Broker KRaft + Kafka UI (overlay) |
| `docker/grafana/dashboards/kafka.json` | Dashboard Grafana pré-construit |
