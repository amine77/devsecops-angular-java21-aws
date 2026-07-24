# Phase 20 — Kubernetes Free Tier : EC2 t3.micro + SWAP + K3s + ArgoCD

> ⚠️ **Mode alternatif, non déployé en production.** La production réelle du portfolio
> tourne en Docker Compose sur une EC2 t3.small (voir [PHASE1-Architecture.md](PHASE1-Architecture.md)).
> Ce mode K3s (`deployment_mode = "k3s"`) reste un code Terraform complet et une démonstration
> de compétence Kubernetes/GitOps, mais n'est pas ce qui sert https://charrad-devsecops.duckdns.org.
>
> **⚠️ Impact de la suppression de RDS (24/07/2026)** : ce document décrivait à l'origine
> RDS PostgreSQL comme base de données. RDS a depuis été définitivement supprimé (module
> retiré de `terraform/main.tf`). Ce mode K3s pointe toujours vers les variables
> `rds_host`/`rds_port` (désormais câblées en dur sur `"postgres"`/`5432`, le nom du
> conteneur Docker Compose du mode réel) — **cette valeur ne résout à rien dans un cluster
> K3s**, qui n'a pas de conteneur Postgres équivalent. Concrètement : si ce mode était
> réactivé aujourd'hui tel quel, l'application n'aurait pas de base de données accessible.
> Il faudrait ajouter un déploiement Postgres dans le cluster (ou pointer vers une base
> externe) avant de pouvoir le redéployer. Ceci n'a pas été corrigé volontairement — ce
> mode n'étant pas utilisé en production, ce n'est pas une priorité tant qu'il n'est pas
> réactivé.

## Objectif

Déployer un cluster Kubernetes opérationnel sur AWS Free Tier (~$0/mois les 12 premiers mois)
en contournant la limitation RAM de l'instance t3.micro (1GB) grâce à un SWAP file de 4GB.
ArgoCD gère ensuite tout le déploiement via GitOps (Phase 18-19).

---

## Pourquoi pas EKS ?

| | EKS | t3.micro + K3s |
|---|---|---|
| **Coût/mois** | ~$142 | ~$0 (Free Tier) |
| **Control plane** | Géré AWS ($73/mois) | K3s intégré (gratuit) |
| **HA** | Multi-node | Single-node |
| **Production-ready** | Oui | Non (demo/portfolio) |
| **ArgoCD/Helm** | Oui | **Oui** |
| **Signal CV** | Fort | Fort (créativité + frugalité) |

---

## Architecture

```
AWS Free Tier
┌──────────────────────────────────────────────────────────┐
│  EC2 t3.micro (eu-west-3a)                               │
│  ┌──────────────────────────────────────────────────┐    │
│  │  RAM physique : 1GB                              │    │
│  │  SWAP EBS     : 4GB (sur les 30GB gratuits)     │    │
│  │                                                  │    │
│  │  K3s (single-node)                               │    │
│  │  ├── kube-system : CoreDNS + Traefik (~350MB)   │    │
│  │  ├── argocd      : ArgoCD minimal (~200MB)      │    │
│  │  └── portfolio-dev                               │    │
│  │      ├── portfolio-backend  (Spring Boot 256MB) │    │
│  │      └── portfolio-frontend (NGINX ~30MB)       │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  Elastic IP (fixe, gratuite si attachée)                 │
│  Port 80  → Traefik → portfolio-frontend                │
│  Port 30080 → ArgoCD UI                                 │
└──────────────────────────────────────────────────────────┘

⚠️ Pas de base de données câblée par défaut depuis la suppression de RDS le
   24/07/2026 (historiquement : RDS db.t3.micro en subnet privé). À ajouter
   avant réactivation de ce mode — voir l'avertissement en tête de document.
```

---

## SWAP — Pourquoi c'est nécessaire

Sans SWAP, la RAM de 1GB se répartit ainsi :

```
OS Ubuntu/AL2023    200 MB
K3s + Traefik       350 MB
Spring Boot (base)  300 MB  ← Sature avant même de charger les routes
────────────────────────────
Total RAM           850 MB  → OOM Killer tue les pods après quelques minutes
```

Avec 4GB SWAP :

```
RAM physique   1 000 MB → réservée pour OS, K3s, ArgoCD
SWAP EBS       4 000 MB → Spring Boot déborde ici lors des pics (lecture lente)
───────────────────────
Mémoire totale 5 000 MB → stabilité garantie (SWAP est beaucoup plus lent que RAM)
```

**⚠️ Note performances** : le SWAP sur EBS gp3 = ~125MB/s (vs RAM = ~20GB/s).
Les premières requêtes à Spring Boot peuvent prendre 2-5s pendant le swap.
Acceptable pour un portfolio. Inacceptable en production.

---

## Configuration JVM Spring Boot (values-k3s.yaml)

```yaml
JAVA_TOOL_OPTIONS: >-
  -Xmx256m               # Heap max : 256MB (vs 512MB par défaut)
  -Xms64m                # Heap initial minimal
  -XX:MaxMetaspaceSize=120m  # Classes chargées
  -Xss256k               # Stack threads (vs 512k par défaut)
  -XX:+UseG1GC           # GC adapté aux petites heaps
  -XX:MaxGCPauseMillis=200
  -XX:+ExitOnOutOfMemoryError  # Crash propre si OOM (K3s redémarre le pod)
```

Spring Boot total estimé : 256MB heap + 120MB Metaspace + threads = ~380MB

---

## Déploiement pas à pas

### Prérequis

```bash
# 1. Clé SSH dans AWS
aws ec2 create-key-pair \
  --key-name portfolio-key \
  --query "KeyMaterial" \
  --output text > portfolio-key.pem
chmod 400 portfolio-key.pem

# 2. SES : vérifier les emails (Lambda notifications)
aws ses verify-email-identity \
  --email-address amine.charrad@gmail.com \
  --region eu-west-3
```

### Configurer terraform.tfvars

```bash
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
# Éditer avec tes vraies valeurs :
# - db_password        : mot de passe PostgreSQL
# - jwt_secret         : openssl rand -base64 64
# - argocd_admin_password : openssl rand -base64 16
# - ec2_key_name       : "portfolio-key"
# - allowed_ssh_cidr   : ton IP : curl ifconfig.me
```

### Appliquer Terraform

```bash
cd terraform

# Initialiser
terraform init

# Prévisualiser (vérifier les ressources créées)
terraform plan -out=tfplan

# Appliquer (~5 minutes pour créer VPC + EC2 — pas de RDS, voir avertissement en tête de document)
terraform apply tfplan
```

### Attendre le bootstrap K3s (~8-12 min)

```bash
# Récupérer l'IP publique
EC2_IP=$(terraform output -raw ec2_public_ip)
echo "IP : $EC2_IP"

# Suivre les logs de bootstrap
ssh -i portfolio-key.pem ec2-user@$EC2_IP \
  "tail -f /var/log/user-data.log"

# Le message final indique que tout est prêt :
# "=== BOOTSTRAP TERMINÉ"
```

### Vérifier l'état du cluster

```bash
# Se connecter à l'instance
ssh -i portfolio-key.pem ec2-user@$EC2_IP

# Sur l'instance :
kubectl get nodes
# NAME            STATUS   ROLES                  AGE
# portfolio-k3s   Ready    control-plane,master   10m

kubectl get pods -A
# NAMESPACE      NAME                                      READY   STATUS
# kube-system    coredns-...                               1/1     Running
# kube-system    traefik-...                               1/1     Running
# argocd         argocd-server-...                         1/1     Running
# portfolio-dev  portfolio-backend-...                     1/1     Running
# portfolio-dev  portfolio-frontend-...                    1/1     Running

# Vérifier le SWAP
free -h
# Mem:   1.0Gi   800Mi   200Mi
# Swap:  4.0Gi   500Mi   3.5Gi  ← Spring Boot utilise ~500MB de swap
```

### Accéder aux services

```bash
# Application portfolio
echo "http://$EC2_IP"

# ArgoCD UI (port 30080)
echo "http://$EC2_IP:30080"
# Login : admin / <argocd_admin_password de terraform.tfvars>
```

---

## Coût réel estimé

> Ce mode n'étant pas déployé, ces coûts sont théoriques (basés sur les prix Free Tier
> AWS) et n'incluent pas la base de données, qui n'est plus câblée par défaut (voir
> l'avertissement en tête de document).

| Service | Free Tier | Coût après 12 mois |
|---|---|---|
| EC2 t3.micro | 750h/mois gratuit | ~$8/mois |
| Base de données (à ajouter) | — | non chiffré, dépend de la solution choisie |
| EBS 28GB (gp3) | 30GB gratuit | $0 (dans la limite) |
| ECR | 500MB gratuit | $0 (images <500MB) |
| EIP (attachée) | Gratuite | Gratuite |
| **Total (hors DB)** | **~$0/mois** (12 mois) | **~$8/mois** |

---

## Commandes utiles post-déploiement

```bash
# Connexion SSH
ssh -i portfolio-key.pem ec2-user@<IP>

# Voir les logs ArgoCD
kubectl logs -n argocd deployment/argocd-server --tail=50

# Voir l'utilisation mémoire en temps réel
watch -n5 "free -h && kubectl top pods -A 2>/dev/null || kubectl get pods -A"

# Déclencher une sync ArgoCD manuellement
kubectl exec -it -n argocd deployment/argocd-server -- \
  argocd app sync portfolio-dev --insecure --server localhost:8080

# Rollback à la révision Helm précédente
kubectl exec -it -n argocd deployment/argocd-server -- \
  argocd app rollback portfolio-dev 1 --insecure --server localhost:8080

# Surveiller les events (OOM, restarts)
kubectl get events -A --sort-by='.metadata.creationTimestamp' | tail -20

# Détruire l'infrastructure (arrêter la facturation)
terraform destroy
```

---

## Security Group — Ports ouverts

| Port | Protocole | Source | Usage |
|---|---|---|---|
| 22 | TCP | Ton IP | SSH |
| 80 | TCP | 0.0.0.0/0 | Portfolio (Traefik) |
| 443 | TCP | 0.0.0.0/0 | HTTPS (futur cert-manager) |
| 30080 | TCP | Ton IP | ArgoCD UI (NodePort) |

> **Note** : Le port 6443 (K3s API) n'est pas ouvert sur internet.
> Accès kubectl uniquement en SSH ou via kubectl en local avec tunnel.

---

## Limitations connues

1. **Single-node** : si le nœud tombe, tout tombe. Pas de HA.
2. **SWAP lent** : les premières requêtes Spring Boot sous charge sont lentes.
3. **Pas de LoadBalancer** : Traefik NodePort sur port 80 direct.
4. **ArgoCD non sécurisé** : HTTP sur port 30080 (ajouter TLS en production).
5. **ECR token expire** : cron refresh toutes les 6h (token dure 12h).

---

## Références

- [K3s Documentation](https://docs.k3s.io)
- [K3s + SWAP](https://docs.k3s.io/advanced#additional-preparation-for-debian-buster-based-distributions)
- [Traefik avec K3s](https://doc.traefik.io/traefik/providers/kubernetes-ingress/)
- [AWS Free Tier](https://aws.amazon.com/free/)
