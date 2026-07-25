# Phase 7 — Observabilité (Logging + Métriques + Alertes)

## Vue d'ensemble

Cette phase implémente une observabilité complète de bout en bout :

| Couche | Outil | Accès |
|--------|-------|-------|
| Logs structurés | Logback + Logstash Encoder | CloudWatch Logs Insights |
| Métriques | Micrometer + Prometheus | `/actuator/prometheus` |
| Visualisation | Grafana (local) | `http://localhost:3000` |
| Alertes | CloudWatch Alarms + SNS | Email + AWS Console |

---

## 1. Logs structurés (SLF4J + Logback)

### Architecture

```
HTTP Request
     │
     ▼
RequestCorrelationFilter  ← @Order(1), s'exécute avant Spring Security
     │  MDC.put("requestId", uuid)
     │  MDC.put("httpMethod", "POST")
     │  MDC.put("httpPath", "/api/auth/login")
     ▼
AuthService.login()
     │  MDC.put("userId", user.getEmail())   ← injecté après auth réussie
     ▼
logback-spring.xml
     │  profil dev  → Console colorée avec requestId
     │  profil prod → JSON structuré (LogstashEncoder + AsyncAppender)
     ▼
CloudWatch Logs → Log Group: /portfolio/backend
```

### Format JSON en prod

```json
{
  "@timestamp": "2026-01-15T10:23:45.123Z",
  "level": "INFO",
  "thread_name": "virtual-thread-42",
  "logger_name": "c.p.b.service.AuthService",
  "message": "Login réussi pour: admin@portfolio.dev",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "httpMethod": "POST",
  "httpPath": "/api/auth/login",
  "userId": "admin@portfolio.dev",
  "app": "portfolio-backend",
  "env": "prod"
}
```

### Requêtes CloudWatch Logs Insights utiles

```sql
-- Tracer une requête complète par requestId
fields @timestamp, level, message, requestId, userId
| filter requestId = "550e8400-e29b-41d4-a716-446655440000"
| sort @timestamp asc

-- Toutes les erreurs des 30 dernières minutes
fields @timestamp, level, message, requestId
| filter level = "ERROR"
| sort @timestamp desc
| limit 20

-- Tentatives d'auth échouées (détection brute-force)
fields @timestamp, message, requestId
| filter message like "Unauthorized access attempt"
| stats count(*) as failures by bin(1m)
| sort @timestamp desc
```

---

## 2. Métriques Prometheus (Micrometer)

### Métriques custom (`AppMetrics.java`)

| Métrique Prometheus | Description | Incrémentée dans |
|---------------------|-------------|-----------------|
| `auth_login_success_total` | Logins réussis | `AuthService.login()` |
| `auth_login_failure_total` | Échecs d'auth | `GlobalExceptionHandler.handleUnauthorized()` |
| `auth_login_rate_limited_total{reason}` | Requêtes de login rejetées par le limiteur — `reason="locked_out"` (5 échecs/15 min) ou `"throttled"` (20 req/min) | `LoginRateLimitFilter` |
| `http_errors_total{status, status_family}` | Erreurs HTTP | `GlobalExceptionHandler.handleUnauthorized()` |
| `operation_duration_seconds{operation}` | Durée opérations métier | Usage manuel via `Timer` |

### Métriques auto (Micrometer Spring Boot)

| Métrique | Description |
|----------|-------------|
| `http_server_requests_seconds_{count,sum,bucket}` | Latence HTTP p50/p95/p99 |
| `jvm_memory_used_bytes{area, id}` | Mémoire JVM (heap + non-heap) |
| `jvm_gc_pause_seconds_{sum,count}` | Durée des GC pauses |
| `hikaricp_connections_{active,idle,pending}` | État du pool de connexions |
| `process_cpu_usage` | CPU du processus Java |
| `system_cpu_usage` | CPU système |

### Endpoint Actuator

```bash
# En dev (profil dev expose health, info, metrics, prometheus)
curl http://localhost:8080/actuator/prometheus

# Exemple de sortie
auth_login_success_total{result="success"} 42.0
auth_login_failure_total{result="failure"} 3.0
auth_login_rate_limited_total{reason="locked_out"} 2.0
http_errors_total{status="401",status_family="4xx"} 3.0
http_server_requests_seconds_count{method="POST",status="200",uri="/api/auth/login"} 42.0
```

---

## 3. Stack locale (Docker Compose)

### Démarrage

```bash
# Option 1 : Stack complète (backend + frontend + postgres + prometheus + grafana)
docker-compose -f docker/docker-compose.yml -f docker/docker-compose.observability.yml up -d

# Option 2 : Uniquement Prometheus + Grafana (si le backend tourne nativement)
# Prérequis : créer le réseau manuellement
docker network create portfolio-network
docker-compose -f docker/docker-compose.observability.yml up -d
```

### Accès

| Service | URL | Credentials |
|---------|-----|-------------|
| Prometheus | http://localhost:9090 | — |
| Grafana | http://localhost:3000 | admin / admin |
| Backend Actuator | http://localhost:8080/actuator/prometheus | — |

### Architecture Docker

```
prometheus:9090
    │  scrape /actuator/prometheus toutes les 15s
    ▼
backend:8080
    
grafana:3000
    │  Datasource provisionnée automatiquement
    ▼
prometheus:9090
    │  Dashboard provisonné depuis docker/grafana/dashboards/portfolio.json
    ▼
4 sections :
  🔐 Authentification — taux login/failure, ratio brute-force
  🌐 HTTP — erreurs 4xx/5xx, latence p50/p95/p99
  ☕ JVM — heap/non-heap, GC pauses
  🗄️ DB — HikariCP connections, temps d'acquisition
```

---

## 4. CloudWatch (AWS Production)

### Ressources Terraform créées

```hcl
module "cloudwatch" {
  source = "./modules/cloudwatch"
  # Log Group : /portfolio/backend (rétention 30 jours)
  # Log Metric Filters : AuthLoginFailures, Http5xxErrors
  # SNS Topic + abonnement email
  # CloudWatch Alarms :
  #   - CPU EC2 > 80% (5 min)
  #   - Auth failures > 10 / minute
  #   - HTTP 5xx > 5 / minute
  # CloudWatch Dashboard : 5 widgets (CPU, mémoire, auth, 5xx, logs)
}
```

### Activation des logs CloudWatch sur EC2

Le IAM Instance Profile EC2 doit avoir la policy `CloudWatchAgentServerPolicy`.
Ajouter dans `user-data.sh.tpl` :

```bash
# Installer et configurer CloudWatch Agent
yum install -y amazon-cloudwatch-agent

cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << EOF
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/portfolio/backend.log",
            "log_group_name": "/portfolio/backend",
            "log_stream_name": "{instance_id}",
            "timestamp_format": "%Y-%m-%dT%H:%M:%S"
          }
        ]
      }
    }
  }
}
EOF

/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json \
  -s
```

### Requêtes PromQL utiles (Grafana)

```promql
# Taux d'échec d'authentification (alerte si > 10%)
rate(auth_login_failure_total[5m])
  / (rate(auth_login_success_total[5m]) + rate(auth_login_failure_total[5m]) + 0.0001)

# Latence p95 sur les 5 dernières minutes
histogram_quantile(0.95,
  sum(rate(http_server_requests_seconds_bucket[5m])) by (le))

# Connexions HikariCP actives (alerte si proche du max=5)
hikaricp_connections_active{pool="PortfolioHikariPool"}
```

---

## 5. Décisions techniques

### Pourquoi MDC et pas des paramètres dans chaque log ?

Le MDC (Mapped Diagnostic Context) est un mécanisme SLF4J qui attache des paires clé/valeur au contexte du thread courant. Logback les inclut automatiquement dans chaque ligne de log.

**Avantages** :
- Pas de duplication dans chaque `log.info()` — le `requestId` est là automatiquement
- SonarLint S2629 évité (pas d'évaluation de méthodes dans les arguments de log)
- Compatible Virtual Threads Java 21 (MDC.clear() dans le `finally` du filter)

### Pourquoi AsyncAppender en prod ?

Sans AsyncAppender, chaque ligne de log JSON bloque le thread applicatif pendant la sérialisation et l'écriture. Sur Virtual Threads (Java 21), cela crée de la contention inutile. L'AsyncAppender utilise une queue de 512 éléments — les logs sont écrits par un thread dédié.

### Pourquoi séparer AppMetrics dans une classe dédiée ?

SRP (Single Responsibility Principle) : la gestion des compteurs Prometheus est une responsabilité distincte de la logique métier. `AppMetrics` est testable indépendamment avec un `SimpleMeterRegistry`.

```java
// Test unitaire isolé
AppMetrics metrics = new AppMetrics(new SimpleMeterRegistry());
metrics.incrementLoginSuccess();
// Vérifier le compteur sans Spring context
```

### Pourquoi ne pas tagger le path dans `http.errors` ?

```java
// NON — cardinalité explosive → OOM Prometheus
Counter.builder("http.errors").tag("path", request.getRequestURI())

// OUI — cardinalité maîtrisée
Counter.builder("http.errors").tag("status", "401").tag("status_family", "4xx")
```

Un tag `path` sur des milliers de routes différentes crée une série temporelle par chemin → mémoire Prometheus explose. On log le path dans le message SLF4J à la place.

---

## 6. Fichiers créés / modifiés

### Nouveaux fichiers

| Fichier | Description |
|---------|-------------|
| `backend/src/main/resources/logback-spring.xml` | Config Logback dev (couleur) + prod (JSON) |
| `backend/src/main/java/.../observability/RequestCorrelationFilter.java` | Filtre MDC requestId |
| `backend/src/main/java/.../observability/AppMetrics.java` | Compteurs Micrometer |
| `docker/prometheus/prometheus.yml` | Config scrape Prometheus |
| `docker/docker-compose.observability.yml` | Stack Prometheus + Grafana |
| `docker/grafana/provisioning/datasources/prometheus.yml` | Datasource auto-provisionnée |
| `docker/grafana/provisioning/dashboards/dashboard.yml` | Provider dashboard |
| `docker/grafana/dashboards/portfolio.json` | Dashboard pré-construit (4 sections) |
| `terraform/modules/cloudwatch/main.tf` | Log Group + Alarms + Dashboard |
| `terraform/modules/cloudwatch/variables.tf` | Variables du module |
| `terraform/modules/cloudwatch/outputs.tf` | Outputs (log group ARN, dashboard URL) |

### Fichiers modifiés

| Fichier | Modification |
|---------|-------------|
| `backend/pom.xml` | Ajout `micrometer-registry-prometheus` + `logstash-logback-encoder` |
| `backend/src/main/resources/application.properties` | Exposition endpoint `prometheus` |
| `backend/src/main/resources/application-prod.properties` | Exposition prometheus, suppression `logging.pattern.console` |
| `backend/.../exception/GlobalExceptionHandler.java` | Injection `AppMetrics`, appel `incrementLoginFailure()` |
| `backend/.../service/AuthService.java` | Injection `AppMetrics`, `MDC.put("userId")`, `incrementLoginSuccess()` |
| `terraform/main.tf` | Ajout module `cloudwatch` |
| `terraform/variables.tf` | Ajout variable `alert_email` |
| `terraform/outputs.tf` | Ajout outputs CloudWatch |
