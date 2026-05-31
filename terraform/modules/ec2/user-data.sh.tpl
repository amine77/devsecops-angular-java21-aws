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
docker pull "$ECR_BACKEND_URL:$IMAGE_TAG"
docker pull "$ECR_FRONTEND_URL:$IMAGE_TAG"
echo "Images pullées"

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
# Pas de PostgreSQL ici : la DB est managée par AWS RDS.
# NGINX (frontend) proxie /api/* vers backend:8080
# =============================================================================

services:

  backend:
    image: $ECR_BACKEND_URL:$IMAGE_TAG
    container_name: portfolio-backend
    restart: unless-stopped
    environment:
      SPRING_PROFILES_ACTIVE: prod
      SPRING_DATASOURCE_URL: jdbc:postgresql://$RDS_HOST:$RDS_PORT/$DB_NAME?ssl=true&sslmode=require
      SPRING_DATASOURCE_USERNAME: $DB_USERNAME
      SPRING_DATASOURCE_PASSWORD: $DB_PASSWORD
      JWT_SECRET: $JWT_SECRET
      JWT_EXPIRATION_MS: 86400000
      SERVER_PORT: 8080
    ports:
      - "8080:8080"
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
COMPOSE

echo "docker-compose.yml créé"

# =============================================================================
# ÉTAPE 6 — Démarrage des services
# =============================================================================
echo "=== [6/7] Démarrage de la stack ==="
cd /opt/portfolio
docker compose up -d
echo "Services démarrés"

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
# SCRIPT DE DÉPLOIEMENT SANS DOWNTIME
# =============================================================================
# Permet de faire `sudo /opt/portfolio/deploy.sh` pour mettre à jour l'app
cat > /opt/portfolio/deploy.sh <<'DEPLOY'
#!/bin/bash
set -e
echo "[deploy] Pulling latest images..."
cd /opt/portfolio
aws ecr get-login-password --region "$(aws configure get region)" \
  | docker login --username AWS --password-stdin \
    "$(docker compose config | grep 'image:' | head -1 | awk '{print $2}' | cut -d'/' -f1)"
docker compose pull
echo "[deploy] Restarting services (zero-downtime rolling)..."
docker compose up -d --no-deps --build backend
sleep 10
docker compose up -d --no-deps --build frontend
echo "[deploy] Done. Status:"
docker compose ps
DEPLOY

chmod +x /opt/portfolio/deploy.sh

echo "=== USER DATA COMPLETE: $(date) ==="
echo "Application démarrée sur http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
