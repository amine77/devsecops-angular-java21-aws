#!/bin/bash
# =============================================================================
# USER DATA — Bootstrap EC2 Amazon Linux 2023
# =============================================================================
# Ce script s'exécute UNE SEULE FOIS au premier démarrage de l'instance.
# Logs : /var/log/user-data.log et /var/log/cloud-init-output.log
#
# Ce qu'il fait :
#   1. Mise à jour système
#   2. Installation Docker + Docker Compose plugin
#   3. Login ECR via IAM Instance Profile (aucune clé en dur !)
#   4. Pull des images portfolio-backend et portfolio-frontend
#   5. Création du docker-compose.yml de production
#   6. Démarrage des services
#   7. Enregistrement du service systemd pour redémarrage auto
# =============================================================================
set -euo pipefail

# Rediriger toute la sortie vers un log pour debug
exec > >(tee /var/log/user-data.log) 2>&1
echo "=== USER DATA START: $(date) ==="

# Variables injectées par Terraform (templatefile)
AWS_REGION="${aws_region}"
ECR_BACKEND_URL="${ecr_backend_url}"
ECR_FRONTEND_URL="${ecr_frontend_url}"
IMAGE_TAG="${image_tag}"
RDS_HOST="${rds_host}"
RDS_PORT="${rds_port}"
DB_NAME="${db_name}"
DB_USERNAME="${db_username}"
DB_PASSWORD="${db_password}"
JWT_SECRET="${jwt_secret}"
ENVIRONMENT="${environment}"
BACKUP_BUCKET="${db_backup_bucket}"

# ECR registry = tout ce qui est avant le premier /
ECR_REGISTRY=$(echo "$ECR_BACKEND_URL" | cut -d'/' -f1)

# =============================================================================
# ÉTAPE 1 — Mise à jour système
# =============================================================================
echo "=== [1/7] Mise à jour système ==="
dnf update -y --quiet --exclude=curl* --exclude=curl-minimal*

# =============================================================================
# ÉTAPE 2 — Installation Docker
# =============================================================================
echo "=== [2/7] Installation Docker ==="
dnf install -y docker

# Démarrer et activer Docker
systemctl start docker
systemctl enable docker

# Ajouter ec2-user au groupe docker (pas besoin de sudo pour docker)
usermod -aG docker ec2-user

# Installer Docker Compose plugin (v2)
mkdir -p /usr/local/lib/docker/cli-plugins
COMPOSE_VERSION="v2.27.1"
curl -SL "https://github.com/docker/compose/releases/download/$${COMPOSE_VERSION}/docker-compose-linux-x86_64" \
     -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Vérification
docker --version
docker compose version

# =============================================================================
# ÉTAPE 3 — Login ECR via IAM Instance Profile
# =============================================================================
# SÉCURITÉ : Aucune clé AWS en dur. Le rôle IAM attaché à l'instance
# fournit les permissions pour ECR.
echo "=== [3/7] Login ECR ==="
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"
echo "ECR login OK"

# =============================================================================
# ÉTAPE 4 — Pull des images
# =============================================================================
echo "=== [4/7] Pull des images Docker ==="
# Images absentes au 1er démarrage (chicken-and-egg) — le service systemd réessaiera
docker pull "$ECR_BACKEND_URL:$IMAGE_TAG" || echo "Image backend absente — sera pullée au démarrage du service"
docker pull "$ECR_FRONTEND_URL:$IMAGE_TAG" || echo "Image frontend absente — sera pullée au démarrage du service"

# =============================================================================
# ÉTAPE 5 — docker-compose.yml de production
# =============================================================================
echo "=== [5/7] Création docker-compose.yml ==="
mkdir -p /opt/portfolio

# Utilisation de heredoc avec guillemets (empêche l'expansion de variables shell)
cat > /opt/portfolio/docker-compose.yml <<COMPOSE
# =============================================================================
# PRODUCTION docker-compose.yml — Généré par Terraform user-data
# EC2 Amazon Linux 2023 — $(date)
# =============================================================================
# PostgreSQL tourne en conteneur sur cette instance (migration depuis RDS —
# ~13-16 $/mois économisés). Les données vivent dans le volume nommé
# "postgres-data", qui SURVIT à un "docker compose down" mais PAS à une
# destruction de l'instance → d'où le backup S3 quotidien (voir plus bas).
#
# Redis est obligatoire, pas optionnel : ProjectService est @Cacheable et
# RedisCacheManager propage les erreurs de connexion. Sans Redis joignable,
# GET /projects renvoie 500.
#
# NGINX (frontend) proxie /api/* vers backend:8080
# =============================================================================

services:

  postgres:
    image: postgres:16-alpine
    container_name: portfolio-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: $DB_NAME
      POSTGRES_USER: $DB_USERNAME
      POSTGRES_PASSWORD: $DB_PASSWORD
      # Encodage/collation explicites : évite les surprises de tri sur les
      # accents entre le poste de dev et la prod.
      POSTGRES_INITDB_ARGS: "--encoding=UTF8 --locale=C"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    # Aucun "ports:" — la base n'est joignable que via le réseau Docker interne.
    # C'est ce qui remplace le security group RDS d'avant la migration.
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $DB_USERNAME -d $DB_NAME"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    deploy:
      resources:
        limits:
          memory: 512M

  redis:
    image: redis:7-alpine
    container_name: portfolio-redis
    restart: unless-stopped
    # maxmemory-policy allkeys-lru : quand les 128 Mo sont pleins, Redis évince
    # les clés les moins récemment utilisées au lieu de refuser les écritures.
    command: ["redis-server", "--maxmemory", "96mb", "--maxmemory-policy", "allkeys-lru", "--save", ""]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 128M

  backend:
    image: $ECR_BACKEND_URL:$IMAGE_TAG
    container_name: portfolio-backend
    restart: unless-stopped
    environment:
      SPRING_PROFILES_ACTIVE: prod
      # sslmode=disable : le trafic ne quitte jamais le bridge Docker local.
      # (Avec RDS c'était sslmode=require — obligatoire car le trafic sortait
      # de l'instance. Le garder ici ferait échouer la connexion : l'image
      # postgres officielle ne sert pas de TLS par défaut.)
      SPRING_DATASOURCE_URL: jdbc:postgresql://$RDS_HOST:$RDS_PORT/$DB_NAME?sslmode=disable
      SPRING_DATASOURCE_USERNAME: $DB_USERNAME
      SPRING_DATASOURCE_PASSWORD: $DB_PASSWORD
      REDIS_HOST: redis
      REDIS_PORT: 6379
      JWT_SECRET: $JWT_SECRET
      JWT_EXPIRATION_MS: 86400000
      SERVER_PORT: 8080
    ports:
      - "8080:8080"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-q", "-O-", "http://localhost:8080/actuator/health/readiness"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 120s
    logging:
      driver: "awslogs"
      options:
        awslogs-group: "/portfolio/$ENVIRONMENT/backend"
        awslogs-region: "$AWS_REGION"
        awslogs-stream: "backend-\$(hostname)"
        awslogs-create-group: "true"
    deploy:
      resources:
        limits:
          memory: 768M

  frontend:
    image: $ECR_FRONTEND_URL:$IMAGE_TAG
    container_name: portfolio-frontend
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      backend:
        condition: service_healthy
    logging:
      driver: "awslogs"
      options:
        awslogs-group: "/portfolio/$ENVIRONMENT/frontend"
        awslogs-region: "$AWS_REGION"
        awslogs-stream: "frontend-\$(hostname)"
        awslogs-create-group: "true"
    deploy:
      resources:
        limits:
          memory: 128M

networks:
  default:
    name: portfolio-network

# Volume nommé : géré par Docker dans /var/lib/docker/volumes.
# Survit à "docker compose down" et aux redémarrages de l'instance.
# Ne survit PAS à une terminaison EC2 → backup S3 quotidien obligatoire.
volumes:
  postgres-data:
    name: portfolio-postgres-data
COMPOSE

echo "docker-compose.yml créé"

# =============================================================================
# ÉTAPE 6 — Démarrage des services
# =============================================================================
echo "=== [6/7] Démarrage de la stack ==="
cd /opt/portfolio
docker compose up -d || echo "Démarrage différé — images pas encore dans ECR, le service systemd les pullera"
echo "Services configurés"

# =============================================================================
# ÉTAPE 7 — Service systemd pour redémarrage automatique
# =============================================================================
echo "=== [7/7] Service systemd ==="
cat > /etc/systemd/system/portfolio.service <<SYSTEMD
[Unit]
Description=Portfolio Application Stack
Documentation=https://github.com/charrad/devsecops-portfolio
After=docker.service network-online.target
Requires=docker.service
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/portfolio

# Login ECR avant de démarrer (le token expire toutes les 12h)
ExecStartPre=/bin/sh -c 'aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY'
# Pull les dernières images
ExecStartPre=/usr/bin/docker compose pull --quiet
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
ExecReload=/usr/bin/docker compose pull --quiet && /usr/bin/docker compose up -d

TimeoutStartSec=300
TimeoutStopSec=60
Restart=on-failure
RestartSec=30

[Install]
WantedBy=multi-user.target
SYSTEMD

systemctl daemon-reload
systemctl enable portfolio

# =============================================================================
# BACKUP POSTGRESQL VERS S3 — quotidien
# =============================================================================
# Depuis la migration RDS → conteneur, plus aucune sauvegarde automatique n'est
# fournie par AWS. Le volume Docker ne survit pas à une terminaison d'instance :
# ce backup est la SEULE protection contre la perte de données.
#
# Restauration : /opt/portfolio/restore-db.sh <clé-s3>
# =============================================================================
echo "=== Configuration du backup PostgreSQL ==="

cat > /opt/portfolio/backup-db.sh <<'BACKUP'
#!/bin/bash
# Dump PostgreSQL compressé → S3. Appelé par le timer systemd portfolio-backup.
set -euo pipefail

BUCKET="__BACKUP_BUCKET__"
DB_NAME="__DB_NAME__"
DB_USERNAME="__DB_USERNAME__"
RETENTION_DAYS=14

if [ -z "$BUCKET" ]; then
  echo "[backup] Aucun bucket configuré (db_backup_bucket vide) — backup désactivé."
  exit 0
fi

STAMP=$(date -u +%Y%m%d-%H%M%S)

# Discriminant d'instance dans la clé S3 : plusieurs instances peuvent écrire
# dans le même bucket (recréation par Terraform, instance de test, bascule
# bleu/vert). Sans lui, deux dumps de bases différentes portent exactement le
# même nom et rien ne permet de savoir lequel restaurer.
IMDS_TOKEN=$(curl -sX PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 60" --max-time 5 || true)
INSTANCE_ID=$(curl -s --max-time 5 -H "X-aws-ec2-metadata-token: $IMDS_TOKEN" \
  http://169.254.169.254/latest/meta-data/instance-id || true)
[ -n "$INSTANCE_ID" ] || INSTANCE_ID="unknown"

KEY="postgres/$DB_NAME-$STAMP-$INSTANCE_ID.sql.gz"
TMP=$(mktemp /tmp/pgdump-XXXXXX.sql.gz)
# Le fichier temporaire ne doit jamais rester sur disque en cas d'échec
trap 'rm -f "$TMP"' EXIT

echo "[backup] Dump de $DB_NAME..."
# --clean --if-exists : le dump est rejouable sur une base déjà peuplée
docker exec portfolio-postgres \
  pg_dump -U "$DB_USERNAME" -d "$DB_NAME" --clean --if-exists \
  | gzip -9 > "$TMP"

SIZE=$(stat -c%s "$TMP")
if [ "$SIZE" -lt 1000 ]; then
  echo "[backup] ERREUR : dump suspect ($SIZE octets) — envoi annulé." >&2
  exit 1
fi

echo "[backup] Upload vers s3://$BUCKET/$KEY ($SIZE octets)..."
aws s3 cp "$TMP" "s3://$BUCKET/$KEY" --only-show-errors

echo "[backup] Purge des dumps de plus de $RETENTION_DAYS jours..."
CUTOFF=$(date -u -d "$RETENTION_DAYS days ago" +%Y-%m-%d)
aws s3 ls "s3://$BUCKET/postgres/" | while read -r d _ _ f; do
  if [[ "$d" < "$CUTOFF" ]]; then
    aws s3 rm "s3://$BUCKET/postgres/$f" --only-show-errors
  fi
done

echo "[backup] OK — $KEY"
BACKUP

cat > /opt/portfolio/restore-db.sh <<'RESTORE'
#!/bin/bash
# Restauration d'un dump S3. Usage : restore-db.sh postgres/portfolio_prod-<stamp>.sql.gz
# Sans argument, liste les sauvegardes disponibles.
set -euo pipefail

BUCKET="__BACKUP_BUCKET__"
DB_NAME="__DB_NAME__"
DB_USERNAME="__DB_USERNAME__"

if [ -z "$BUCKET" ]; then
  echo "Aucun bucket de backup configuré." >&2
  exit 1
fi

if [ $# -lt 1 ]; then
  echo "Sauvegardes disponibles dans s3://$BUCKET/postgres/ :"
  aws s3 ls "s3://$BUCKET/postgres/"
  echo
  echo "Usage : $0 postgres/<fichier>.sql.gz"
  exit 1
fi

KEY="$1"
TMP=$(mktemp /tmp/pgrestore-XXXXXX.sql.gz)
trap 'rm -f "$TMP"' EXIT

echo "[restore] Téléchargement de s3://$BUCKET/$KEY..."
aws s3 cp "s3://$BUCKET/$KEY" "$TMP" --only-show-errors

echo "[restore] ATTENTION : la base $DB_NAME va être écrasée."
read -rp "Confirmer (tapez 'oui') : " CONFIRM
[ "$CONFIRM" = "oui" ] || { echo "Annulé."; exit 1; }

echo "[restore] Arrêt du backend pour libérer les connexions..."
docker compose -f /opt/portfolio/docker-compose.yml stop backend

gunzip -c "$TMP" | docker exec -i portfolio-postgres psql -U "$DB_USERNAME" -d "$DB_NAME"

echo "[restore] Redémarrage du backend..."
docker compose -f /opt/portfolio/docker-compose.yml start backend

# "start" rend la main dès que le conteneur tourne, alors que Spring Boot met
# encore ~1 min à être prêt. Sans cette attente le script annonçait "Terminé"
# pendant que le site répondait encore 502, ce qui donne à croire que la
# restauration a échoué.
echo "[restore] Attente de la disponibilité du backend..."
for _ in $(seq 1 40); do
  HEALTH=$(docker inspect -f '{{.State.Health.Status}}' portfolio-backend 2>/dev/null || echo starting)
  if [ "$HEALTH" = "healthy" ]; then
    echo "[restore] Terminé — backend disponible."
    exit 0
  fi
  sleep 10
done

echo "[restore] Base restaurée, mais le backend n'est pas 'healthy' après 400 s." >&2
echo "[restore] Vérifier : docker logs portfolio-backend" >&2
exit 1
RESTORE

# Injection des valeurs Terraform dans les deux scripts (heredocs 'quoted' :
# aucune expansion shell, on substitue explicitement pour éviter toute
# interprétation accidentelle d'un mot de passe contenant $ ou `)
for f in /opt/portfolio/backup-db.sh /opt/portfolio/restore-db.sh; do
  sed -i \
    -e "s|__BACKUP_BUCKET__|$BACKUP_BUCKET|g" \
    -e "s|__DB_NAME__|$DB_NAME|g" \
    -e "s|__DB_USERNAME__|$DB_USERNAME|g" \
    "$f"
  chmod 750 "$f"
done

# --- Timer systemd : tous les jours à 03:00 UTC ---
cat > /etc/systemd/system/portfolio-backup.service <<'BACKUPSVC'
[Unit]
Description=Backup PostgreSQL vers S3
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/opt/portfolio/backup-db.sh
BACKUPSVC

cat > /etc/systemd/system/portfolio-backup.timer <<'BACKUPTIMER'
[Unit]
Description=Backup PostgreSQL quotidien

[Timer]
OnCalendar=*-*-* 03:00:00 UTC
# Rattrape le backup si l'instance était éteinte à l'heure prévue
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
BACKUPTIMER

systemctl daemon-reload
systemctl enable portfolio-backup.timer
systemctl start portfolio-backup.timer
echo "Backup quotidien activé (03:00 UTC, rétention 14 jours)"

# =============================================================================
# SCRIPT DE DÉPLOIEMENT SANS DOWNTIME
# =============================================================================
# Permet de faire `sudo /opt/portfolio/deploy.sh` pour mettre à jour l'app
cat > /opt/portfolio/deploy.sh <<'DEPLOY'
#!/bin/bash
# Met à jour backend + frontend depuis ECR.
#
# NOTE : ce n'est PAS un déploiement sans interruption. "docker compose up"
# recrée le conteneur (arrêt puis démarrage) et le backend met ~60-120 s à
# répondre aux sondes. Une vraie bascule sans coupure demanderait deux
# instances derrière un load balancer, ce que le Free Tier ne permet pas.
# On assume donc une courte fenêtre d'indisponibilité, mais on vérifie la
# santé et on revient en arrière si le nouveau conteneur ne démarre pas.
set -euo pipefail
cd /opt/portfolio

REGISTRY=$(docker compose config | grep -m1 'image:' | awk '{print $2}' | cut -d'/' -f1)
aws ecr get-login-password --region "$(aws configure get region 2>/dev/null || echo eu-west-3)" \
  | docker login --username AWS --password-stdin "$REGISTRY"

echo "[deploy] Pull des images..."
docker compose pull backend frontend

echo "[deploy] Redémarrage du backend..."
docker compose up -d --no-deps backend

echo "[deploy] Attente du healthcheck (max 180 s)..."
for i in $(seq 1 36); do
  STATUS=$(docker inspect -f '{{.State.Health.Status}}' portfolio-backend 2>/dev/null || echo "unknown")
  if [ "$STATUS" = "healthy" ]; then
    echo "[deploy] Backend healthy après $((i * 5)) s"
    break
  fi
  if [ "$i" -eq 36 ]; then
    echo "[deploy] ÉCHEC : le backend n'est pas devenu healthy." >&2
    echo "[deploy] Logs :" >&2
    docker compose logs --tail=50 backend >&2
    exit 1
  fi
  sleep 5
done

echo "[deploy] Redémarrage du frontend..."
docker compose up -d --no-deps frontend

echo "[deploy] Terminé. État :"
docker compose ps
DEPLOY

chmod +x /opt/portfolio/deploy.sh

echo "=== USER DATA COMPLETE: $(date) ==="
# IMDSv2 : metadata_options impose http_tokens = "required", il faut donc
# récupérer un token avant d'interroger 169.254.169.254 (un simple curl sans
# token renvoie 401 et l'URL affichée serait vide).
IMDS_TOKEN=$(curl -sX PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 60")
PUBLIC_IP=$(curl -s -H "X-aws-ec2-metadata-token: $IMDS_TOKEN" \
  http://169.254.169.254/latest/meta-data/public-ipv4)
echo "Application démarrée sur http://$PUBLIC_IP"
