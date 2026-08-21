# =============================================================================
# Makefile — Commandes du projet DevSecOps Portfolio
# =============================================================================
# Centralise toutes les commandes en raccourcis mémorisables.
#
# PRÉREQUIS : GNU Make installé
#   Windows : choco install make  (Chocolatey)
#             ou winget install GnuWin32.Make
#   Linux/Mac : make est natif
#
# UTILISATION :
#   make help         → affiche cette aide
#   make build        → build les 2 images Docker
#   make up           → lance tout l'environnement
#   make down         → arrête et supprime les conteneurs
#   make logs         → affiche les logs en live
#   make test         → lance tous les tests
#   make clean        → supprime les conteneurs, volumes et images
#
# CONVENTION :
#   .PHONY déclare les targets qui ne sont pas des fichiers.
#   Sans .PHONY, Make chercherait un fichier nommé "build", "up", etc.
# =============================================================================

# Couleurs pour une sortie lisible dans le terminal
CYAN    := \033[0;36m
GREEN   := \033[0;32m
YELLOW  := \033[0;33m
RED     := \033[0;31m
RESET   := \033[0m
BOLD    := \033[1m

# Variables configurables via l'environnement
COMPOSE_FILE     ?= docker/docker-compose.yml
COMPOSE_OVERRIDE ?= docker/docker-compose.override.yml
AWS_ACCOUNT_ID   ?= $(shell aws sts get-caller-identity --query Account --output text 2>/dev/null)
AWS_REGION       ?= eu-west-3
ECR_REGISTRY     := $(AWS_ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com
IMAGE_TAG        ?= latest
TF_DIR           ?= terraform
TF_VARS          ?= $(TF_DIR)/terraform.tfvars

.PHONY: help build build-backend build-frontend up up-prod down logs logs-backend logs-frontend \
        test test-backend test-frontend test-e2e test-load test-load-auth test-load-admin test-load-all \
        lint lint-backend lint-frontend \
        push-ecr push-backend push-frontend \
        clean clean-containers clean-volumes clean-images \
        db-connect shell-backend shell-frontend \
        trivy-scan security-check test-dast test-dast-baseline \
        sbom sbom-backend sbom-frontend sbom-lambdas \
        sonar-backend sonar-frontend \
        cosign-verify scorecard \
        status health \
        tf-init tf-validate tf-plan tf-apply tf-destroy tf-output tf-fmt \
        lambda-build lambda-build-weekly-report lambda-build-image-resize \
        lambda-invoke-weekly-report ses-verify

# =============================================================================
# AIDE — cible par défaut
# =============================================================================
help: ## Affiche cette aide
	@echo ""
	@echo "$(BOLD)$(CYAN)╔══════════════════════════════════════════════════╗$(RESET)"
	@echo "$(BOLD)$(CYAN)║   DevSecOps Portfolio — Makefile Commands        ║$(RESET)"
	@echo "$(BOLD)$(CYAN)╚══════════════════════════════════════════════════╝$(RESET)"
	@echo ""
	@echo "$(BOLD)🐳 DOCKER :$(RESET)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '(build|up|down|logs|clean|status|health)' \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-22s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(BOLD)🧪 TESTS :$(RESET)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '(test|lint)' \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-22s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(BOLD)🚀 ECR / DÉPLOIEMENT :$(RESET)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '(push|ecr)' \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-22s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(BOLD)🔒 SÉCURITÉ :$(RESET)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '(trivy|security|shell|db)' \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-22s$(RESET) %s\n", $$1, $$2}'
	@echo ""

# =============================================================================
# BUILD — Construction des images Docker
# =============================================================================
build: build-backend build-frontend ## Build les 2 images Docker (backend + frontend)
	@echo "$(GREEN)✔ Images buildées avec succès$(RESET)"

build-backend: ## Build l'image Docker du backend Spring Boot
	@echo "$(CYAN)▶ Build backend...$(RESET)"
	docker build \
		--tag portfolio-backend:$(IMAGE_TAG) \
		--file backend/Dockerfile \
		--label "build.date=$(shell date -u +%Y-%m-%dT%H:%M:%SZ)" \
		--label "build.version=$(IMAGE_TAG)" \
		./backend
	@echo "$(GREEN)✔ Backend buildé : portfolio-backend:$(IMAGE_TAG)$(RESET)"

build-frontend: ## Build l'image Docker du frontend Angular + NGINX
	@echo "$(CYAN)▶ Build frontend...$(RESET)"
	docker build \
		--tag portfolio-frontend:$(IMAGE_TAG) \
		--file frontend/Dockerfile \
		--label "build.date=$(shell date -u +%Y-%m-%dT%H:%M:%SZ)" \
		--label "build.version=$(IMAGE_TAG)" \
		./frontend
	@echo "$(GREEN)✔ Frontend buildé : portfolio-frontend:$(IMAGE_TAG)$(RESET)"

# =============================================================================
# DOCKER COMPOSE — Gestion de l'environnement
# =============================================================================
up: ## Lance l'environnement de développement complet (avec override)
	@echo "$(CYAN)▶ Démarrage de l'environnement dev...$(RESET)"
	@if [ -f "$(COMPOSE_OVERRIDE)" ]; then \
		docker compose -f $(COMPOSE_FILE) -f $(COMPOSE_OVERRIDE) up -d; \
	else \
		docker compose -f $(COMPOSE_FILE) up -d; \
	fi
	@echo "$(GREEN)✔ Environnement démarré$(RESET)"
	@echo ""
	@echo "  Frontend  : http://localhost:4200"
	@echo "  Backend   : http://localhost:8080"
	@echo "  Swagger   : http://localhost:8080/swagger-ui.html"
	@echo "  DB        : localhost:5432 (portfolio_dev)"
	@echo ""

up-prod: ## Lance l'environnement de simulation production
	@echo "$(YELLOW)▶ Démarrage en mode PRODUCTION (simulation)...$(RESET)"
	docker compose -f $(COMPOSE_FILE) -f docker/docker-compose.prod.yml up -d
	@echo "$(GREEN)✔ Environnement prod simulé démarré$(RESET)"

down: ## Arrête et supprime les conteneurs (conserve les volumes)
	@echo "$(CYAN)▶ Arrêt des conteneurs...$(RESET)"
	docker compose -f $(COMPOSE_FILE) down
	@echo "$(GREEN)✔ Conteneurs arrêtés$(RESET)"

restart: down up ## Redémarre l'environnement complet

status: ## Affiche l'état des conteneurs
	@echo "$(BOLD)$(CYAN)État des conteneurs :$(RESET)"
	docker compose -f $(COMPOSE_FILE) ps

health: ## Vérifie la santé des services
	@echo "$(BOLD)$(CYAN)Health checks :$(RESET)"
	@echo ""
	@echo "$(CYAN)Backend :$(RESET)"
	@curl -s http://localhost:8080/actuator/health | python -m json.tool 2>/dev/null \
		|| curl -s http://localhost:8080/actuator/health || echo "$(RED)Backend inaccessible$(RESET)"
	@echo ""
	@echo "$(CYAN)Frontend :$(RESET)"
	@curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:4200/health \
		|| echo "$(RED)Frontend inaccessible$(RESET)"
	@echo ""

# =============================================================================
# LOGS — Consultation des logs
# =============================================================================
logs: ## Affiche les logs de tous les services (Ctrl+C pour quitter)
	docker compose -f $(COMPOSE_FILE) logs --follow --tail=100

logs-backend: ## Affiche les logs du backend uniquement
	docker compose -f $(COMPOSE_FILE) logs --follow --tail=200 backend

logs-frontend: ## Affiche les logs du frontend NGINX uniquement
	docker compose -f $(COMPOSE_FILE) logs --follow --tail=100 frontend

logs-postgres: ## Affiche les logs PostgreSQL
	docker compose -f $(COMPOSE_FILE) logs --follow --tail=100 postgres

# =============================================================================
# TESTS — Exécution des tests
# =============================================================================
test: test-backend test-frontend ## Lance tous les tests (backend + frontend)
	@echo "$(GREEN)✔ Tous les tests passés$(RESET)"

test-backend: ## Lance les tests Maven (unitaires + intégration + coverage)
	@echo "$(CYAN)▶ Tests backend...$(RESET)"
	cd backend && mvn verify -Ptest
	@echo "$(GREEN)✔ Tests backend OK$(RESET)"
	@echo "  Rapport : backend/target/site/jacoco/index.html"

test-backend-unit: ## Lance uniquement les tests unitaires (rapide)
	@echo "$(CYAN)▶ Tests unitaires backend...$(RESET)"
	cd backend && mvn test -Dgroups="unit" 2>/dev/null \
		|| cd backend && mvn test -Dtest="**/*Test" -Dit.test="none"

test-backend-it: ## Lance uniquement les tests d'intégration (Testcontainers)
	@echo "$(CYAN)▶ Tests d'intégration backend (Testcontainers)...$(RESET)"
	cd backend && mvn verify -DskipTests=false -Dtest=none -Dit.test="**/*IT"

test-frontend: ## Lance les tests Jest Angular
	@echo "$(CYAN)▶ Tests frontend...$(RESET)"
	cd frontend && npm test -- --watchAll=false --coverage
	@echo "$(GREEN)✔ Tests frontend OK$(RESET)"
	@echo "  Rapport : frontend/coverage/lcov-report/index.html"

test-frontend-watch: ## Lance Jest en mode watch (développement)
	cd frontend && npm test

test-e2e: ## Lance les tests Cypress E2E (nécessite l'appli lancée)
	@echo "$(CYAN)▶ Tests E2E Cypress...$(RESET)"
	cd frontend && npx cypress run

test-load: ## Lance la simulation Gatling principale — GET /projects 100 users (prérequis: backend démarré)
	@echo "$(CYAN)▶ Test de charge Gatling — simulation SLA principale...$(RESET)"
	cd backend && mvn gatling:test -Dgatling.simulationClass=com.portfolio.backend.loadtest.PublicProjectsSimulation
	@echo "$(GREEN)✔ Rapport : backend/target/gatling/$(RESET)"

test-load-auth: ## Lance la simulation Gatling stress login (50 users)
	@echo "$(CYAN)▶ Test de charge Gatling — stress login...$(RESET)"
	cd backend && mvn gatling:test -Dgatling.simulationClass=com.portfolio.backend.loadtest.AuthStressSimulation
	@echo "$(GREEN)✔ Rapport : backend/target/gatling/$(RESET)"

test-load-admin: ## Lance la simulation Gatling flux admin CRUD (5 users)
	@echo "$(CYAN)▶ Test de charge Gatling — flux admin CRUD...$(RESET)"
	cd backend && mvn gatling:test -Dgatling.simulationClass=com.portfolio.backend.loadtest.AdminFlowSimulation
	@echo "$(GREEN)✔ Rapport : backend/target/gatling/$(RESET)"

test-load-all: ## Lance toutes les simulations Gatling séquentiellement
	@echo "$(CYAN)▶ Toutes les simulations Gatling...$(RESET)"
	$(MAKE) test-load
	@sleep 5
	$(MAKE) test-load-auth
	@sleep 5
	$(MAKE) test-load-admin
	@echo "$(GREEN)✔ Tous les tests de charge terminés — rapports dans backend/target/gatling/$(RESET)"

# =============================================================================
# LINTING — Qualité du code
# =============================================================================
lint: lint-backend lint-frontend ## Lint backend + frontend
	@echo "$(GREEN)✔ Lint OK$(RESET)"

lint-backend: ## Vérifie le style Java avec Checkstyle
	@echo "$(CYAN)▶ Checkstyle backend...$(RESET)"
	cd backend && mvn checkstyle:check

lint-frontend: ## Lint TypeScript/Angular avec ESLint
	@echo "$(CYAN)▶ ESLint frontend...$(RESET)"
	cd frontend && npm run lint

lint-frontend-fix: ## Corrige automatiquement les erreurs ESLint
	cd frontend && npm run lint -- --fix

format-check: ## Vérifie le formatage Prettier
	cd frontend && npx prettier --check "src/**/*.{ts,html,scss}"

format-fix: ## Applique le formatage Prettier
	cd frontend && npx prettier --write "src/**/*.{ts,html,scss}"

# =============================================================================
# AMAZON ECR — Push des images
# =============================================================================
ecr-login: ## Authentifie Docker auprès d'Amazon ECR
	@echo "$(CYAN)▶ Login ECR ($(AWS_REGION))...$(RESET)"
	aws ecr get-login-password --region $(AWS_REGION) \
		| docker login --username AWS --password-stdin $(ECR_REGISTRY)
	@echo "$(GREEN)✔ Authentifié sur ECR$(RESET)"

push-ecr: ecr-login push-backend push-frontend ## Build, tag et push les 2 images sur ECR
	@echo "$(GREEN)✔ Images pushées sur ECR$(RESET)"

push-backend: ## Tag et push l'image backend sur ECR
	@echo "$(CYAN)▶ Push backend → ECR...$(RESET)"
	docker tag portfolio-backend:$(IMAGE_TAG) \
		$(ECR_REGISTRY)/portfolio-backend:$(IMAGE_TAG)
	docker push $(ECR_REGISTRY)/portfolio-backend:$(IMAGE_TAG)

push-frontend: ## Tag et push l'image frontend sur ECR
	@echo "$(CYAN)▶ Push frontend → ECR...$(RESET)"
	docker tag portfolio-frontend:$(IMAGE_TAG) \
		$(ECR_REGISTRY)/portfolio-frontend:$(IMAGE_TAG)
	docker push $(ECR_REGISTRY)/portfolio-frontend:$(IMAGE_TAG)

# =============================================================================
# SÉCURITÉ — Scan et hardening
# =============================================================================
test-dast: ## Lance OWASP ZAP API scan contre le backend local (prérequis: backend démarré + JWT token)
	@echo "$(CYAN)▶ DAST — OWASP ZAP API Scan...$(RESET)"
	@command -v docker >/dev/null 2>&1 || (echo "$(RED)✘ Docker requis pour ZAP$(RESET)" && exit 1)
	@if [ -z "$$(curl -sf http://localhost:8080/actuator/health/readiness 2>/dev/null)" ]; then \
		echo "$(RED)✘ Backend non démarré. Lancer : make up  ou  mvn spring-boot:run$(RESET)"; \
		exit 1; \
	fi
	@echo "$(CYAN)  Obtention du token JWT admin...$(RESET)"
	@mkdir -p zap/reports
	@TOKEN=$$(curl -sf -X POST http://localhost:8080/auth/login \
		-H "Content-Type: application/json" \
		-d '{"email":"admin@portfolio.dev","password":"Admin@2024!"}' \
		| python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])" 2>/dev/null); \
	if [ -z "$$TOKEN" ]; then \
		echo "$(RED)✘ Impossible d'obtenir le token JWT$(RESET)"; \
		exit 1; \
	fi; \
	echo "Authorization: Bearer $$TOKEN" > zap/auth-header.txt; \
	echo "Content-Type: application/json" >> zap/auth-header.txt; \
	echo "$(CYAN)  Démarrage du scan ZAP API (OpenAPI)...$(RESET)"; \
	docker run --rm \
		--network host \
		-v $$(pwd)/zap:/zap/wrk/:rw \
		ghcr.io/zaproxy/zaproxy:stable \
		zap-api-scan.py \
		-t http://localhost:8080/v3/api-docs \
		-f openapi \
		-H /zap/wrk/auth-header.txt \
		-c /zap/wrk/zap-rules.tsv \
		-r /zap/wrk/reports/zap-report.html \
		-J /zap/wrk/reports/zap-report.json \
		2>&1; \
	rm -f zap/auth-header.txt
	@echo "$(GREEN)✔ Scan DAST terminé$(RESET)"
	@echo "  Rapport HTML : zap/reports/zap-report.html"
	@echo "  Rapport JSON : zap/reports/zap-report.json"

test-dast-baseline: ## Lance ZAP Baseline (scan passif uniquement, plus rapide)
	@echo "$(CYAN)▶ DAST — OWASP ZAP Baseline (passif)...$(RESET)"
	@command -v docker >/dev/null 2>&1 || (echo "$(RED)✘ Docker requis pour ZAP$(RESET)" && exit 1)
	@mkdir -p zap/reports
	docker run --rm \
		--network host \
		-v $$(pwd)/zap:/zap/wrk/:rw \
		ghcr.io/zaproxy/zaproxy:stable \
		zap-baseline.py \
		-t http://localhost:8080 \
		-c /zap/wrk/zap-rules.tsv \
		-r /zap/wrk/reports/zap-baseline.html \
		2>&1
	@echo "$(GREEN)✔ Baseline terminé : zap/reports/zap-baseline.html$(RESET)"

trivy-scan: ## Scanne les 2 images avec Trivy (vulnérabilités)
	@echo "$(CYAN)▶ Scan Trivy backend...$(RESET)"
	trivy image --exit-code 1 --severity HIGH,CRITICAL portfolio-backend:$(IMAGE_TAG)
	@echo "$(CYAN)▶ Scan Trivy frontend...$(RESET)"
	trivy image --exit-code 1 --severity HIGH,CRITICAL portfolio-frontend:$(IMAGE_TAG)
	@echo "$(GREEN)✔ Aucune vulnérabilité HIGH/CRITICAL$(RESET)"

trivy-report: ## Génère un rapport HTML Trivy
	@mkdir -p reports
	trivy image --format template --template "@/contrib/html.tpl" \
		-o reports/trivy-backend.html portfolio-backend:$(IMAGE_TAG)
	trivy image --format template --template "@/contrib/html.tpl" \
		-o reports/trivy-frontend.html portfolio-frontend:$(IMAGE_TAG)
	@echo "  Rapports : reports/trivy-*.html"

security-check: ## Vérifie la config sécurité Docker (docker bench)
	@echo "$(CYAN)▶ Docker Bench Security...$(RESET)"
	docker run --rm --net host --pid host --userns host --cap-add audit_control \
		-e DOCKER_CONTENT_TRUST=$(DOCKER_CONTENT_TRUST) \
		-v /etc:/etc:ro \
		-v /lib/systemd/system:/lib/systemd/system:ro \
		-v /usr/bin/containerd:/usr/bin/containerd:ro \
		-v /usr/bin/runc:/usr/bin/runc:ro \
		-v /usr/lib/systemd:/usr/lib/systemd:ro \
		-v /var/lib:/var/lib:ro \
		-v /var/run/docker.sock:/var/run/docker.sock:ro \
		--label docker_bench_security \
		docker/docker-bench-security 2>/dev/null \
		|| echo "$(YELLOW)⚠ Docker Bench Security nécessite Linux$(RESET)"

# =============================================================================
# SHELL — Accès aux conteneurs
# =============================================================================
shell-backend: ## Ouvre un shell dans le conteneur backend
	docker compose -f $(COMPOSE_FILE) exec backend sh

shell-frontend: ## Ouvre un shell dans le conteneur frontend NGINX
	docker compose -f $(COMPOSE_FILE) exec frontend sh

shell-postgres: ## Ouvre psql dans le conteneur PostgreSQL
	docker compose -f $(COMPOSE_FILE) exec postgres \
		psql -U portfolio_user -d portfolio_dev

db-connect: shell-postgres ## Alias pour se connecter à la DB

# =============================================================================
# NETTOYAGE — Libération de l'espace disque
# =============================================================================
clean: clean-containers clean-images ## Supprime conteneurs, volumes et images du projet
	@echo "$(GREEN)✔ Nettoyage terminé$(RESET)"

clean-containers: ## Supprime les conteneurs et volumes du projet
	@echo "$(CYAN)▶ Suppression des conteneurs et volumes...$(RESET)"
	docker compose -f $(COMPOSE_FILE) down --volumes --remove-orphans

clean-images: ## Supprime les images Docker locales du projet
	@echo "$(CYAN)▶ Suppression des images...$(RESET)"
	-docker rmi portfolio-backend:$(IMAGE_TAG) 2>/dev/null
	-docker rmi portfolio-frontend:$(IMAGE_TAG) 2>/dev/null
	@echo "$(GREEN)✔ Images supprimées$(RESET)"

clean-all: clean ## Supprime aussi les images dangling (non taguées)
	@echo "$(CYAN)▶ Nettoyage complet Docker...$(RESET)"
	docker system prune -f
	@echo "$(GREEN)✔ Nettoyage système Docker OK$(RESET)"

# =============================================================================
# UTILITAIRES
# =============================================================================
image-sizes: ## Affiche la taille des images construites
	@echo "$(BOLD)$(CYAN)Taille des images :$(RESET)"
	@docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" \
		| grep -E "(portfolio|REPOSITORY)"

image-layers: ## Affiche les layers de l'image backend
	@echo "$(BOLD)$(CYAN)Layers backend :$(RESET)"
	docker history portfolio-backend:$(IMAGE_TAG) --human --format "table {{.Size}}\t{{.CreatedBy}}"

# =============================================================================
# TERRAFORM — Infrastructure AWS
# =============================================================================
tf-init: ## terraform init — Télécharge les providers
	@echo "$(CYAN)▶ Terraform init...$(RESET)"
	cd $(TF_DIR) && terraform init
	@echo "$(GREEN)✔ Providers téléchargés$(RESET)"

tf-validate: ## terraform validate — Valide la syntaxe HCL
	@echo "$(CYAN)▶ Terraform validate...$(RESET)"
	cd $(TF_DIR) && terraform validate
	@echo "$(GREEN)✔ Configuration valide$(RESET)"

tf-fmt: ## terraform fmt — Formate les fichiers .tf
	@echo "$(CYAN)▶ Terraform fmt...$(RESET)"
	cd $(TF_DIR) && terraform fmt -recursive
	@echo "$(GREEN)✔ Fichiers formatés$(RESET)"

tf-plan: ## terraform plan — Aperçu des changements (sans déployer)
	@echo "$(CYAN)▶ Terraform plan...$(RESET)"
	@if [ ! -f "$(TF_VARS)" ]; then \
		echo "$(RED)✘ $(TF_VARS) manquant. Copier terraform.tfvars.example$(RESET)"; \
		exit 1; \
	fi
	cd $(TF_DIR) && terraform plan -var-file=$(notdir $(TF_VARS)) -out=tfplan
	@echo "$(GREEN)✔ Plan sauvegardé dans terraform/tfplan$(RESET)"

tf-apply: ## terraform apply — Déploie l'infrastructure AWS
	@echo "$(YELLOW)▶ Terraform apply — Déploiement AWS...$(RESET)"
	@echo "$(YELLOW)⚠ Cette commande crée des ressources AWS qui peuvent être facturées.$(RESET)"
	@if [ ! -f "$(TF_DIR)/tfplan" ]; then \
		$(MAKE) tf-plan; \
	fi
	cd $(TF_DIR) && terraform apply tfplan
	@echo "$(GREEN)✔ Infrastructure déployée$(RESET)"
	@$(MAKE) tf-output

tf-destroy: ## terraform destroy — SUPPRIME toute l'infrastructure
	@echo "$(RED)⚠ ATTENTION : Cette commande supprime TOUTE l'infrastructure AWS !$(RESET)"
	@echo "$(RED)⚠ Les données RDS seront perdues si skip_final_snapshot = true$(RESET)"
	@read -p "Confirmer la destruction ? (yes/no) : " confirm && [ "$$confirm" = "yes" ] || exit 1
	cd $(TF_DIR) && terraform destroy -var-file=$(notdir $(TF_VARS))
	@echo "$(GREEN)✔ Infrastructure supprimée$(RESET)"

tf-output: ## Affiche les outputs Terraform (IP, URLs, commandes)
	@echo "$(BOLD)$(CYAN)Outputs Terraform :$(RESET)"
	cd $(TF_DIR) && terraform output

tf-ssh: ## SSH vers l'EC2 via les outputs Terraform
	@EC2_IP=$$(cd $(TF_DIR) && terraform output -raw ec2_public_ip 2>/dev/null); \
	KEY=$$(cd $(TF_DIR) && terraform output -raw ec2_key_name 2>/dev/null || echo "portfolio-key"); \
	ssh -i ~/.ssh/$${KEY}.pem ec2-user@$$EC2_IP

# =============================================================================
# LAMBDA — Fonctions serverless
# =============================================================================
lambda-build: lambda-build-weekly-report lambda-build-image-resize ## Build toutes les fonctions Lambda (npm ci)
	@echo "$(GREEN)✔ Toutes les fonctions Lambda buildées$(RESET)"

lambda-build-weekly-report: ## Build la Lambda weekly-report (npm ci --omit=dev)
	@echo "$(CYAN)▶ Build Lambda weekly-report...$(RESET)"
	@command -v node >/dev/null 2>&1 || (echo "$(RED)✘ Node.js requis$(RESET)" && exit 1)
	cd lambdas/weekly-report && npm ci --omit=dev
	@echo "$(GREEN)✔ Lambda weekly-report buildée$(RESET)"

lambda-build-image-resize: ## Build la Lambda image-resize (sharp binaire Linux x86_64)
	@echo "$(CYAN)▶ Build Lambda image-resize...$(RESET)"
	@command -v node >/dev/null 2>&1 || (echo "$(RED)✘ Node.js requis$(RESET)" && exit 1)
	cd lambdas/image-resize && npm ci --omit=dev \
		--platform=linux --arch=x64 --libc=glibc
	@echo "$(GREEN)✔ Lambda image-resize buildée (sharp Linux x86_64)$(RESET)"

lambda-invoke-weekly-report: ## Invoque la Lambda weekly-report manuellement (test AWS)
	@echo "$(CYAN)▶ Invocation Lambda weekly-report...$(RESET)"
	@FUNC=$$(cd $(TF_DIR) && terraform output -raw lambda_weekly_report_function_name 2>/dev/null || echo "portfolio-dev-weekly-report"); \
	aws lambda invoke \
		--function-name $$FUNC \
		--region $(AWS_REGION) \
		--log-type Tail \
		--cli-binary-format raw-in-base64-out \
		/tmp/lambda-response.json \
		| python3 -c "import sys,json,base64; r=json.load(sys.stdin); print(base64.b64decode(r.get('LogResult','')).decode())" 2>/dev/null; \
	echo "$(GREEN)✔ Réponse :$(RESET)" && cat /tmp/lambda-response.json

ses-verify: ## Vérifie les 2 adresses email dans SES (sandbox uniquement)
	@echo "$(CYAN)▶ Vérification des emails SES...$(RESET)"
	@test -n "$(SENDER_EMAIL)"    || (echo "$(RED)✘ SENDER_EMAIL non défini$(RESET)" && exit 1)
	@test -n "$(RECIPIENT_EMAIL)" || (echo "$(RED)✘ RECIPIENT_EMAIL non défini$(RESET)" && exit 1)
	aws ses verify-email-identity --email-address $(SENDER_EMAIL)    --region $(AWS_REGION)
	aws ses verify-email-identity --email-address $(RECIPIENT_EMAIL) --region $(AWS_REGION)
	@echo "$(YELLOW)⚠ Ouvre les emails de vérification reçus et clique sur les liens$(RESET)"

# =============================================================================
# PHASE 16 — SÉCURITÉ AVANCÉE
# SonarCloud · SBOM · Cosign · OpenSSF
# =============================================================================

# ---------------------------------------------------------------------------
# SBOM — Software Bill of Materials (CycloneDX)
# ---------------------------------------------------------------------------
sbom: sbom-backend sbom-frontend sbom-lambdas ## Génère le SBOM complet (backend + frontend + lambdas)
	@echo "$(GREEN)✔ SBOMs générés$(RESET)"
	@echo "  Backend  : backend/target/bom.json"
	@echo "  Frontend : frontend/sbom-cyclonedx.json"
	@echo "  Lambdas  : sbom-lambdas.json"

sbom-backend: ## Génère le SBOM CycloneDX du backend Maven (bom.json + bom.xml)
	@echo "$(CYAN)▶ SBOM backend (CycloneDX)...$(RESET)"
	@command -v mvn >/dev/null 2>&1 || (echo "$(RED)✘ Maven requis$(RESET)" && exit 1)
	cd backend && mvn org.cyclonedx:cyclonedx-maven-plugin:makeAggregateBom \
		-DschemaVersion=1.5 \
		-DoutputFormat=all \
		-B -q
	@echo "$(GREEN)✔ SBOM backend : backend/target/bom.json$(RESET)"

sbom-frontend: ## Génère le SBOM CycloneDX du frontend Angular (npm)
	@echo "$(CYAN)▶ SBOM frontend (CycloneDX npm)...$(RESET)"
	@command -v node >/dev/null 2>&1 || (echo "$(RED)✘ Node.js requis$(RESET)" && exit 1)
	cd frontend && npx --yes @cyclonedx/cyclonedx-npm \
		--output-format JSON \
		--output-file sbom-cyclonedx.json \
		--spec-version 1.5 \
		--flatten-components
	@echo "$(GREEN)✔ SBOM frontend : frontend/sbom-cyclonedx.json$(RESET)"

sbom-lambdas: ## Génère le SBOM des Lambdas via Trivy
	@echo "$(CYAN)▶ SBOM lambdas (Trivy CycloneDX)...$(RESET)"
	@command -v trivy >/dev/null 2>&1 || (echo "$(RED)✘ Trivy requis$(RESET)" && exit 1)
	@mkdir -p reports
	trivy fs --format cyclonedx \
		--output reports/sbom-lambdas.json \
		./lambdas
	@echo "$(GREEN)✔ SBOM lambdas : reports/sbom-lambdas.json$(RESET)"

# ---------------------------------------------------------------------------
# SONARCLOUD — Analyse qualité locale (nécessite SONAR_TOKEN)
# ---------------------------------------------------------------------------
sonar-backend: ## Lance l'analyse SonarCloud du backend (SONAR_TOKEN requis)
	@echo "$(CYAN)▶ SonarCloud — Backend Java 21...$(RESET)"
	@test -n "$(SONAR_TOKEN)" || (echo "$(RED)✘ SONAR_TOKEN non défini. Export SONAR_TOKEN=<token>$(RESET)" && exit 1)
	@test -n "$(SONAR_ORGANIZATION)" || (echo "$(RED)✘ SONAR_ORGANIZATION non défini$(RESET)" && exit 1)
	cd backend && mvn sonar:sonar -B \
		-Dsonar.projectKey=portfolio-backend \
		-Dsonar.organization=$(SONAR_ORGANIZATION) \
		-Dsonar.host.url=https://sonarcloud.io \
		-Dsonar.coverage.jacoco.xmlReportPaths=target/site/jacoco/jacoco.xml \
		-Dsonar.token=$(SONAR_TOKEN)
	@echo "$(GREEN)✔ Analyse SonarCloud backend soumise$(RESET)"

sonar-frontend: ## Lance l'analyse SonarCloud du frontend (SONAR_TOKEN_FRONTEND requis)
	@echo "$(CYAN)▶ SonarCloud — Frontend Angular 20...$(RESET)"
	@test -n "$(SONAR_TOKEN_FRONTEND)" || (echo "$(RED)✘ SONAR_TOKEN_FRONTEND non défini$(RESET)" && exit 1)
	@command -v sonar-scanner >/dev/null 2>&1 || \
		(echo "$(YELLOW)⚠ sonar-scanner non installé. Installation : npm i -g sonar-scanner$(RESET)"; \
		 echo "$(YELLOW)  Ou utiliser le workflow GitHub Actions .github/workflows/sonarcloud.yml$(RESET)"; exit 1)
	cd frontend && sonar-scanner \
		-Dsonar.projectKey=portfolio-frontend \
		-Dsonar.organization=$(SONAR_ORGANIZATION) \
		-Dsonar.host.url=https://sonarcloud.io \
		-Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \
		-Dsonar.token=$(SONAR_TOKEN_FRONTEND)
	@echo "$(GREEN)✔ Analyse SonarCloud frontend soumise$(RESET)"

# ---------------------------------------------------------------------------
# COSIGN — Vérification de signature d'image (SLSA)
# ---------------------------------------------------------------------------
cosign-verify: ## Vérifie la signature Cosign d'une image (IMAGE=portfolio-backend:latest)
	@echo "$(CYAN)▶ Vérification signature Cosign...$(RESET)"
	@command -v cosign >/dev/null 2>&1 || \
		(echo "$(YELLOW)⚠ cosign non installé. Installation : https://docs.sigstore.dev/cosign/system_config/installation/$(RESET)" && exit 1)
	@test -n "$(IMAGE)" || (echo "$(RED)✘ IMAGE non défini. Usage : make cosign-verify IMAGE=portfolio-backend:latest$(RESET)" && exit 1)
	cosign verify \
		--certificate-identity-regexp "https://github.com/.*" \
		--certificate-oidc-issuer https://token.actions.githubusercontent.com \
		$(IMAGE)
	@echo "$(GREEN)✔ Signature valide$(RESET)"

# ---------------------------------------------------------------------------
# OPENSSF SCORECARD — Évaluation bonnes pratiques
# ---------------------------------------------------------------------------
scorecard: ## Lance OpenSSF Scorecard sur le dépôt local
	@echo "$(CYAN)▶ OpenSSF Scorecard...$(RESET)"
	@command -v scorecard >/dev/null 2>&1 || \
		(echo "$(YELLOW)⚠ scorecard non installé.$(RESET)" && \
		 echo "$(YELLOW)  Installation : go install sigs.k8s.io/release-utils/cmd/scorecard@latest$(RESET)" && \
		 echo "$(YELLOW)  Ou utiliser le workflow GitHub Actions : .github/workflows/sbom-supply-chain.yml$(RESET)" && exit 1)
	scorecard --local . --format table
	@echo "$(GREEN)✔ Scorecard terminé$(RESET)"

# ---------------------------------------------------------------------------
# PHASE 16 — Tout d'un coup
# ---------------------------------------------------------------------------
security-phase16: sbom trivy-scan ## Phase 16 complète en local (SBOM + Trivy)
	@echo ""
	@echo "$(BOLD)$(GREEN)╔══════════════════════════════════════════╗$(RESET)"
	@echo "$(BOLD)$(GREEN)║  Phase 16 — Security Avancée : OK        ║$(RESET)"
	@echo "$(BOLD)$(GREEN)╚══════════════════════════════════════════╝$(RESET)"
	@echo ""
	@echo "  SonarCloud  : make sonar-backend SONAR_TOKEN=<token> SONAR_ORGANIZATION=<org>"
	@echo "  SBOM        : backend/target/bom.json · frontend/sbom-cyclonedx.json"
	@echo "  Trivy       : make trivy-scan"
	@echo "  Gitleaks    : gitleaks detect --config .gitleaks.toml"
	@echo ""

inspect-network: ## Inspecte le réseau Docker du projet
	docker network inspect portfolio-network

mvn-deps: ## Télécharge les dépendances Maven (pour cache Docker)
	cd backend && mvn dependency:go-offline -q

npm-install: ## Installe les dépendances npm
	cd frontend && npm ci

install: mvn-deps npm-install ## Installe toutes les dépendances (Maven + npm)

# Affiche un résumé de l'environnement
info:
	@echo "$(BOLD)Environnement :$(RESET)"
	@echo "  Docker  : $$(docker --version)"
	@echo "  Compose : $$(docker compose version)"
	@java --version 2>/dev/null || echo "  Java    : non installé localement"
	@node --version 2>/dev/null && echo "  npm     : $$(npm --version)" || echo "  Node    : non installé localement"
	@echo "  ECR     : $(ECR_REGISTRY)"
