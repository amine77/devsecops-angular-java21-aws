#!/bin/bash
# =============================================================================
# USER DATA — Bootstrap EC2 t3.micro : SWAP + K3s + ArgoCD GitOps
# =============================================================================
#
# Phase 20 — Free Tier Kubernetes
#
# Ce script s'exécute UNE SEULE FOIS au premier démarrage de l'instance.
# Durée estimée : 8-12 minutes
# Logs : /var/log/user-data.log
#
# Ce qu'il fait :
#   1. Mise à jour système + dépendances
#   2. SWAP 4GB (nécessaire : 1GB RAM insuffisant pour K3s + Java)
#   3. Installation K3s single-node (Traefik inclus = 0 RAM supplémentaire)
#   4. Helm pour le NGINX Ingress ou Traefik natif K3s
#   5. Namespaces Kubernetes (argocd, portfolio-dev)
#   6. Secret ECR ImagePullSecret + cron de rafraîchissement (token 12h)
#   7. Secret portfolio-secrets (DB, JWT, Redis)
#   8. Installation ArgoCD (lightweight, single replica)
#   9. Bootstrap App of Apps → ArgoCD gère tout le reste via GitOps
#
# Architecture mémoire après démarrage :
#   OS Ubuntu/AL2023   ~200 MB RAM
#   K3s + Traefik      ~350 MB RAM
#   ArgoCD (minimal)   ~200 MB RAM
#   Spring Boot        ~300 MB RAM (déborde sur SWAP avec -Xmx256m)
#   NGINX frontend     ~30  MB RAM
#   ──────────────────────────────
#   Total RAM          ~1080 MB → overflow sur 4GB SWAP sans crash
#
# =============================================================================
set -euo pipefail
exec > >(tee /var/log/user-data.log | logger -t user-data) 2>&1
echo "=== USER DATA START: $(date) ==="

# ---------------------------------------------------------------------------
# Variables injectées par Terraform (templatefile)
# ---------------------------------------------------------------------------
AWS_REGION="${aws_region}"
ECR_BACKEND_URL="${ecr_backend_url}"
ECR_FRONTEND_URL="${ecr_frontend_url}"
RDS_HOST="${rds_host}"
RDS_PORT="${rds_port}"
DB_NAME="${db_name}"
DB_USERNAME="${db_username}"
DB_PASSWORD="${db_password}"
JWT_SECRET="${jwt_secret}"
ENVIRONMENT="${environment}"
GITHUB_REPO="${github_repo}"
ARGOCD_ADMIN_PASSWORD="${argocd_admin_password}"

# Déduit depuis l'URL ECR
ECR_REGISTRY=$(echo "$ECR_BACKEND_URL" | cut -d'/' -f1)

# =============================================================================
# ÉTAPE 1 — Mise à jour système + dépendances
# =============================================================================
echo "=== [1/9] Mise à jour système ==="
dnf update -y --quiet --exclude=curl* --exclude=curl-minimal*
dnf install -y \
  git \
  jq \
  tar \
  openssl \
  aws-cli \
  httpd-tools \
  --quiet
# curl-minimal est pré-installé sur AL2023 et suffit pour K3s — ne pas installer curl (conflit)
# httpd-tools : fournit htpasswd — requis pour hasher le mot de passe ArgoCD (BCrypt)

# =============================================================================
# ÉTAPE 2 — SWAP 4GB
# =============================================================================
# Sans SWAP, K3s + Spring Boot OOM-killent en quelques secondes sur 1GB RAM.
# Même avec -Xmx256m, Spring Boot + Metaspace + K3s saturent la RAM physique.
# Le SWAP sauve l'instance du crash (au prix de latence accrue lors des pics).
echo "=== [2/9] Configuration SWAP 4GB ==="

if [ ! -f /swapfile ]; then
  fallocate -l 4G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=4096
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "SWAP activé : $(free -h | grep Swap)"
fi

# Réduire l'agressivité du swap (le kernel utilise la RAM en priorité)
# vm.swappiness=10 : swap uniquement sous forte pression mémoire
echo 'vm.swappiness=10' >> /etc/sysctl.conf
echo 'vm.vfs_cache_pressure=50' >> /etc/sysctl.conf
sysctl -p

echo "Mémoire après SWAP : $(free -h)"

# =============================================================================
# ÉTAPE 3 — Installation K3s (single-node, Traefik inclus)
# =============================================================================
# Traefik est le contrôleur Ingress natif de K3s.
# On le GARDE (contrairement aux recommandations habituelles) car :
#   - Déjà inclus dans K3s = 0 RAM supplémentaire pour l'installer
#   - Traefik seul = ~50MB RAM (NGINX Ingress = ~100MB)
#   - Désactiver puis réinstaller NGINX = +RAM inutile sur 1GB
#
# Flags :
#   --kubelet-arg=fail-swap-on=false : K8s refuse par défaut si SWAP actif
#   --kubelet-arg=eviction-hard=...  : ne pas killer les pods sous pression
#   --disable=metrics-server         : économise ~30MB RAM
#   --node-name                      : nom explicite dans kubectl get nodes
echo "=== [3/9] Installation K3s ==="

export INSTALL_K3S_EXEC="server \
  --kubelet-arg=fail-swap-on=false \
  --kubelet-arg=eviction-hard=memory.available<100Mi \
  --kubelet-arg=eviction-soft=memory.available<200Mi \
  --kubelet-arg=eviction-soft-grace-period=memory.available=30s \
  --kubelet-arg=image-gc-high-threshold=85 \
  --kubelet-arg=image-gc-low-threshold=70 \
  --disable=metrics-server \
  --node-name=portfolio-k3s \
  --write-kubeconfig-mode=644"

curl -sfL https://get.k3s.io | sh -

# Attendre que K3s soit prêt
echo "Attente de K3s..."
until kubectl get nodes 2>/dev/null | grep -q "Ready"; do
  sleep 5
done
echo "K3s ready : $(kubectl get nodes)"

# Exporter le kubeconfig pour les commandes suivantes
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

# Attendre que CoreDNS et Traefik soient prêts
echo "Attente de CoreDNS et Traefik..."
kubectl wait --for=condition=Ready pods \
  -l app.kubernetes.io/name=traefik \
  -n kube-system \
  --timeout=120s || echo "Traefik pas encore prêt, on continue..."

# =============================================================================
# ÉTAPE 4 — Installation Helm
# =============================================================================
echo "=== [4/9] Installation Helm ==="
curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Vérifier
helm version --short

# =============================================================================
# ÉTAPE 5 — Namespaces Kubernetes
# =============================================================================
echo "=== [5/9] Création des namespaces ==="

kubectl create namespace argocd       --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace portfolio-dev --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace portfolio-prod --dry-run=client -o yaml | kubectl apply -f -

# Labels requis pour ArgoCD
kubectl label namespace portfolio-dev  argocd.argoproj.io/managed-by=argocd --overwrite
kubectl label namespace portfolio-prod argocd.argoproj.io/managed-by=argocd --overwrite

# =============================================================================
# ÉTAPE 6 — Secret ECR (ImagePullSecret) + cron de rafraîchissement
# =============================================================================
# Les tokens ECR expirent après 12h → cron toutes les 6h pour rafraîchir.
# L'IAM Instance Profile permet le login sans stocker de credentials.
echo "=== [6/9] Secret ECR ==="

create_ecr_secret() {
  local NAMESPACE=$1
  echo "Création ECR secret pour namespace: $NAMESPACE"

  ECR_TOKEN=$(aws ecr get-login-password --region "$AWS_REGION")

  kubectl create secret docker-registry ecr-credentials \
    --namespace="$NAMESPACE" \
    --docker-server="$ECR_REGISTRY" \
    --docker-username="AWS" \
    --docker-password="$ECR_TOKEN" \
    --dry-run=client -o yaml | kubectl apply -f -
}

create_ecr_secret argocd
create_ecr_secret portfolio-dev
create_ecr_secret portfolio-prod

# Cron job pour rafraîchir le token ECR (expire toutes les 12h)
cat > /usr/local/bin/refresh-ecr-token.sh << 'CRON_EOF'
#!/bin/bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
AWS_REGION=$(curl -sf http://169.254.169.254/latest/meta-data/placement/region || echo "eu-west-3")
ECR_REGISTRY=$(aws ecr describe-registry --region "$AWS_REGION" \
  --query 'registryId' --output text).dkr.ecr.$${AWS_REGION}.amazonaws.com
ECR_TOKEN=$(aws ecr get-login-password --region "$AWS_REGION")

for NS in argocd portfolio-dev portfolio-prod; do
  kubectl create secret docker-registry ecr-credentials \
    --namespace="$NS" \
    --docker-server="$ECR_REGISTRY" \
    --docker-username="AWS" \
    --docker-password="$ECR_TOKEN" \
    --dry-run=client -o yaml | kubectl apply -f - 2>/dev/null || true
done
CRON_EOF

chmod +x /usr/local/bin/refresh-ecr-token.sh

# Cron toutes les 6h (token dure 12h, on rafraîchit à mi-parcours)
mkdir -p /etc/cron.d
echo "0 */6 * * * root /usr/local/bin/refresh-ecr-token.sh >> /var/log/ecr-refresh.log 2>&1" \
  > /etc/cron.d/ecr-token-refresh

# =============================================================================
# ÉTAPE 7 — Secrets Kubernetes
# =============================================================================
# Phase 21 (External Secrets Operator) :
#   Les secrets portfolio-secrets sont désormais créés AUTOMATIQUEMENT
#   par ESO depuis AWS Secrets Manager (portfolio/dev et portfolio/prod).
#
#   Flux :
#     AWS Secrets Manager (portfolio/dev JSON)
#         ↓ synchronisation toutes les 1h
#     External Secrets Operator (dans K3s)
#         ↓ crée/met à jour
#     Kubernetes Secret "portfolio-secrets" dans portfolio-dev
#         ↓ monté dans les pods
#     Spring Boot (db-url, db-password, jwt-secret, redis-host)
#
#   Avantages :
#     ✅ Zéro secret en clair dans user_data ou Git
#     ✅ Rotation automatique sans redéploiement
#     ✅ Audit trail CloudTrail
#
#   ESO est installé par ArgoCD (argocd/apps/external-secrets-operator.yaml).
#   Les ressources ClusterSecretStore + ExternalSecret sont dans
#   k8s/external-secrets/ (gérées par ArgoCD portfolio-secrets Application).
echo "=== [7/9] Secrets gérés par ESO (External Secrets Operator) ==="
echo "ESO synchronisera portfolio-secrets depuis AWS Secrets Manager (portfolio/dev)."
echo "Aucune action manuelle requise — ArgoCD déploie ESO au démarrage."

# =============================================================================
# ÉTAPE 8 — Installation ArgoCD (lightweight)
# =============================================================================
# Configuration allégée pour t3.micro :
#   - 1 réplica pour chaque composant (pas de HA)
#   - Limites mémoire réduites (~200MB total vs ~500MB par défaut)
#   - Redis intégré (pas de Redis HA séparé)
echo "=== [8/9] Installation ArgoCD ==="

# Ajouter le repo Helm ArgoCD
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update

# Valeurs allégées pour t3.micro
cat > /tmp/argocd-values.yaml << 'ARGOCD_EOF'
# ArgoCD allégé pour t3.micro (1GB RAM + 4GB SWAP)
global:
  image:
    tag: "v2.10.0"

# ---- Server ----
server:
  replicas: 1
  resources:
    requests:
      memory: "64Mi"
      cpu: "25m"
    limits:
      memory: "128Mi"
      cpu: "200m"
  # --insecure : ArgoCD tourne en HTTP (port 8080) — TLS géré par Traefik en amont
  extraArgs:
    - --insecure
  service:
    type: NodePort
    nodePortHttp: 30080      # HTTP (port interne 80) exposé sur NodePort 30080
    # nodePortHttps ne s'applique pas en mode --insecure

# ---- Application Controller ----
controller:
  replicas: 1
  resources:
    requests:
      memory: "128Mi"
      cpu: "50m"
    limits:
      memory: "256Mi"
      cpu: "500m"

# ---- Repo Server ----
repoServer:
  replicas: 1
  resources:
    requests:
      memory: "64Mi"
      cpu: "25m"
    limits:
      memory: "128Mi"
      cpu: "200m"

# ---- Redis (intégré, pas de HA) ----
redis:
  enabled: true
  resources:
    requests:
      memory: "32Mi"
      cpu: "10m"
    limits:
      memory: "64Mi"
      cpu: "100m"

# ---- ApplicationSet Controller ----
applicationSet:
  enabled: true
  replicas: 1
  resources:
    requests:
      memory: "32Mi"
      cpu: "10m"
    limits:
      memory: "64Mi"
      cpu: "100m"

# ---- Notifications ----
notifications:
  enabled: false   # Désactivé pour économiser la RAM
ARGOCD_EOF

helm upgrade --install argocd argo/argo-cd \
  --namespace argocd \
  --values /tmp/argocd-values.yaml \
  --wait \
  --timeout=10m

echo "ArgoCD installé : $(kubectl get pods -n argocd --no-headers | wc -l) pods"

# Changer le mot de passe admin ArgoCD
if [ -n "$ARGOCD_ADMIN_PASSWORD" ]; then
  BCRYPT_HASH=$(htpasswd -nbBC 10 "" "$ARGOCD_ADMIN_PASSWORD" | tr -d ':\n' | sed 's/$2y/$2a/')
  kubectl -n argocd patch secret argocd-secret \
    -p "{\"stringData\":{\"admin.password\":\"$BCRYPT_HASH\",\"admin.passwordMtime\":\"$(date +%FT%T%Z)\"}}"
fi

# =============================================================================
# ÉTAPE 9 — Bootstrap App of Apps (ArgoCD GitOps)
# =============================================================================
# L'App of Apps est le point d'entrée de tout le GitOps.
# Elle crée les Applications portfolio-dev et portfolio-prod,
# qui à leur tour déploient le Helm chart.
echo "=== [9/9] Bootstrap ArgoCD App of Apps ==="

# Attendre qu'ArgoCD soit complètement opérationnel
kubectl wait --for=condition=Available deployment/argocd-server \
  -n argocd \
  --timeout=120s

cat > /tmp/app-of-apps.yaml << APPOFAPPS_EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: portfolio-app-of-apps
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: $GITHUB_REPO
    targetRevision: main
    path: argocd/apps
    directory:
      exclude: "app-of-apps.yaml"
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
APPOFAPPS_EOF

kubectl apply -f /tmp/app-of-apps.yaml

echo "=== BOOTSTRAP TERMINÉ : $(date) ==="
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  Portfolio K3s + ArgoCD prêt !               ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  ArgoCD UI  : http://$(curl -sf http://169.254.169.254/latest/meta-data/public-ipv4):30080"
echo "║  Portfolio  : http://$(curl -sf http://169.254.169.254/latest/meta-data/public-ipv4)"
echo "║  Logs       : /var/log/user-data.log         ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "kubectl get pods -A   # voir tous les pods"
echo "kubectl get apps -n argocd  # voir les ArgoCD Applications"

# =============================================================================
# Post-boot : ajouter kubeconfig pour ec2-user
# =============================================================================
mkdir -p /home/ec2-user/.kube
cp /etc/rancher/k3s/k3s.yaml /home/ec2-user/.kube/config
chown ec2-user:ec2-user /home/ec2-user/.kube/config
echo 'export KUBECONFIG=/home/ec2-user/.kube/config' >> /home/ec2-user/.bashrc

# Installer kubectl alias et auto-complétion
echo 'alias k=kubectl' >> /home/ec2-user/.bashrc
echo 'source <(kubectl completion bash)' >> /home/ec2-user/.bashrc
echo 'complete -F __start_kubectl k' >> /home/ec2-user/.bashrc

echo "=== USER DATA END: $(date) ==="
