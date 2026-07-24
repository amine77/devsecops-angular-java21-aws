# FinOps — Analyse et Surveillance des Coûts AWS

> **Objectif :** Ne jamais avoir de surprise sur la facture AWS.
> Ce document centralise toutes les informations de coût pour le projet DevSecOps Portfolio.

> ⚠️ **Mise à jour majeure 2026-07-24** : ce document décrivait à l'origine une architecture
> 100% Free Tier (EC2 t2.micro + RDS db.t3.micro + Minikube). Ce n'est **plus l'architecture
> réelle** depuis deux évolutions :
> 1. L'EC2 a été recréée en **t3.small** (hors Free Tier) le 2026-06-05 pour supporter NGINX +
>    Certbot + Redis + Prometheus + Grafana en plus de l'app (voir [PHASE1-Architecture.md](PHASE1-Architecture.md)).
> 2. **RDS a été supprimé définitivement le 24/07/2026** — PostgreSQL tourne désormais en
>    conteneur Docker sur la même EC2 (voir [PHASE5-Terraform.md](PHASE5-Terraform.md)).
>
> Les chiffres ci-dessous reflètent les coûts **réels** post-migration. Le mode Kubernetes
> alternatif (K3s, `deployment_mode = "k3s"`, non déployé) vise toujours le Free Tier avec
> une EC2 t3.micro — voir [PHASE20-FreeTier-K3s.md](PHASE20-FreeTier-K3s.md) pour son
> estimation de coût propre (et sa limitation actuelle : plus de base de données câblée
> par défaut depuis la suppression de RDS).

## Table des matières
1. [Configuration des alertes de facturation](#alertes)
2. [Services utilisés et leur coût réel](#services)
3. [Pièges à éviter](#pieges)
4. [Architecture réelle et son impact coût](#architecture)
5. [Historique des coûts](#historique)
6. [Checklist mensuelle de surveillance](#checklist)
7. [Commandes AWS CLI de monitoring](#commandes)
8. [Décisions d'architecture guidées par les coûts](#decisions)

---

## 1. Configuration des alertes de facturation {#alertes}

> ⚠️ **À faire AVANT tout déploiement AWS — sans exception.**

### 1.1 Activer le Billing Dashboard

```
AWS Console → Account (menu haut droite)
→ Billing preferences
→ ✅ "Receive Free Tier Usage Alerts" (email: amine.charrad@gmail.com)
→ ✅ "Receive Billing Alerts"
→ Save preferences
```

### 1.2 Créer un Budget d'alerte

```
AWS Console → Billing → Budgets → Create Budget
→ Use a template → Monthly cost budget
→ Budget name : portfolio-monthly-limit
→ Budgeted amount : $30 (le coût réel actuel tourne autour de ~$22/mois brut)
→ Email recipients : amine.charrad@gmail.com
→ Alert threshold : 80% actual
→ Create budget
```

**Pourquoi $30 ?** Le coût brut réel (hors crédits AWS) est d'environ $22/mois depuis la
suppression de RDS. Un budget à $30 laisse de la marge tout en alertant sur toute dérive
anormale (ex : instance dupliquée, ressource oubliée).

### 1.3 Alerte CloudWatch sur les coûts estimés

```bash
# Via AWS CLI — alerte si la facture estimée dépasse $30
aws cloudwatch put-metric-alarm \
  --alarm-name "BillingAlert-30USD" \
  --alarm-description "Alerte si cout mensuel > 30 USD" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 86400 \
  --threshold 30 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=Currency,Value=USD \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT_ID:billing-alert \
  --region us-east-1
```

> 📌 **Note :** Les métriques de facturation sont uniquement disponibles dans `us-east-1` (N. Virginia), même si vos ressources sont dans `eu-west-3`.

---

## 2. Services utilisés et leur coût réel {#services}

### 2.1 Tableau récapitulatif (post-suppression RDS, 24/07/2026)

| Service | Notre usage réel | Coût brut mensuel |
|---------|-------------------|--------------------|
| **EC2 t3.small** | 1 instance, 24/7 (app + Postgres + Redis + Prometheus + Grafana) | **~$16.50/mois** (hors Free Tier — t3.small n'est pas éligible) |
| **VPC (NAT/data transfer)** | Architecture de base, pas de NAT Gateway | **~$3.30/mois** |
| **EC2-Other** (EBS, EIP) | Volume racine + Elastic IP | **~$1.35/mois** |
| **AWS Secrets Manager** | 1-2 secrets (JWT, etc. — Phase 21) | **~$0.60/mois** |
| **ECR** | ~215MB (backend+frontend) | **~$0.02/mois** (sous les 500MB gratuits) |
| **S3** (state Terraform + backups DB) | Quelques MB (state) + dumps `pg_dump` quotidiens | **~$0.00-0.05/mois** |
| **RDS PostgreSQL** | **Supprimé le 24/07/2026** | **$0.00** (était ~$16/mois avant suppression) |
| **VPC, Subnets, SG, IGW** | Toujours gratuits | **$0.00** |
| **IAM** | Toujours gratuit | **$0.00** |
| **DuckDNS** | 1 sous-domaine | **$0.00** |
| **Certbot + Let's Encrypt** | Certificat TLS | **$0.00** |
| **GitHub Actions** | CI/CD pipelines (repo public) | **$0.00** |

```
┌─────────────────────────────────────────────────────────────┐
│  TOTAL BRUT RÉEL (post-suppression RDS)  :  ~$21-22 / mois  │
│  Couvert partiellement par les crédits AWS actifs du compte  │
│  (voir AWS Console → Facturation → Crédits pour le solde à   │
│  jour — ce document ne fige pas un solde qui varie chaque    │
│  mois)                                                        │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Détail EC2 t3.small

```
t3.small n'est PAS couvert par le Free Tier 12 mois (seuls t2.micro/t3.micro le sont).
Prix on-demand eu-west-3 (Paris) : ~$0.0227/heure
Coût mensuel 24/7 : 744h × $0.0227 ≈ $16.90/mois (~$16.50/mois observé en pratique)

Pourquoi t3.small et pas t3.micro/t2.micro (Free Tier) ?
  → La prod réelle fait tourner sur la même instance : backend, frontend, PostgreSQL,
    Redis, Prometheus, Grafana, NGINX (TLS) — 1GB RAM (t2/t3.micro) ne suffit plus
    depuis que Postgres est passé de RDS (managé, hors instance) à un conteneur local.
  → Voir PHASE1-Architecture.md section 5 pour le budget RAM détaillé (~1.4GB / 2GB utilisés).
```

### 2.3 PostgreSQL — coût disparu, risque transféré

```
Avant le 24/07/2026 : RDS db.t3.micro Single-AZ + 20GB gp2 ≈ $16-19/mois
Depuis le 24/07/2026 : conteneur Docker sur l'EC2 existante → $0 de coût additionnel

Ce que ça change concrètement :
  ✅ Économie directe : ~$18/mois
  ⚠️ Nouveau risque : app + DB sur le même EC2/EBS (SPOF) — accepté pour un blog perso,
     pas pour un site critique. Mitigé par un backup pg_dump quotidien → S3 (systemd timer).
  ⚠️ Plus de backups automatiques gérés par AWS (RDS le faisait) — remplacés par un
     script maison (voir modules/ec2/main.tf, policy IAM db_backup_s3).
```

### 2.4 Détail ECR

```
Free Tier : 500MB de stockage PRIVÉ par compte (toujours, pas de limite 12 mois)

Nos images :
  portfolio-backend:latest  → ~190MB
  portfolio-frontend:latest → ~25MB
  Total                     → ~215MB < 500MB ✅

Bonne pratique : lifecycle policy pour ne garder que les N derniers tags
  → Configuré dans terraform/modules/ecr/ (Phase 5)

Transfert réseau ECR → EC2 (même région) : GRATUIT
Transfert ECR → internet : $0.09/GB → éviter (toujours pull depuis EC2)
```

### 2.5 Elastic IP — Piège courant

```
Elastic IP ATTACHÉE à une EC2 running : $0.00 ✅
Elastic IP NON ATTACHÉE (réservée mais non utilisée) : $0.005/heure = $3.60/mois ⚠️

→ Si vous stoppez votre EC2 sans libérer l'EIP : $3.60/mois de frais
→ Solution : soit libérer l'EIP quand l'EC2 est stoppée
             soit ne stopper l'EC2 que pour maintenance courte

Commande pour vérifier les EIP non attachées :
  aws ec2 describe-addresses --query \
    'Addresses[?AssociationId==null].[PublicIp,AllocationId]' \
    --output table
```

---

## 3. Pièges à éviter — Services à surveiller {#pieges}

| Service | Coût si mal utilisé | Alternative retenue |
|---------|----------------------|----------------------|
| **NAT Gateway** | $0.045/h + $0.045/GB = ~$32/mois | Subnet public direct + IGW |
| **Application Load Balancer (ALB)** | $0.008/h + LCU = ~$16/mois | NGINX natif sur l'EC2 (TLS + reverse proxy) |
| **Route 53 Hosted Zone** | $0.50/zone/mois | DuckDNS (gratuit) |
| **RDS managé** | ~$16-19/mois (historique, jusqu'au 24/07/2026) | PostgreSQL conteneurisé sur l'EC2 |
| **EBS > 30GB** | $0.10/GB/mois au-delà de 30GB | Rester sous 30GB |
| **CloudTrail** | $2/100K events après Free Tier | Monitoring basique Actuator + CloudWatch |
| **EC2 t3.small non-Free-Tier** | ~$16.50/mois assumé | Accepté — nécessaire pour faire tourner toute la stack observabilité + DB sur une seule instance |

### Économies réalisées par nos choix d'architecture

```
NAT Gateway évité        : -$32/mois
ALB évité                : -$16/mois
Route 53 évité           : -$0.50/mois
RDS → conteneur (24/07)  : -$18/mois
                          ──────────
Économies totales        : ~$66.50/mois (vs une architecture "par défaut" équivalente)
```

---

## 4. Architecture réelle et son impact coût {#architecture}

```
┌──────────────────────────────────────────────────────────────┐
│                    VPC (10.0.0.0/16)                         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Subnet PUBLIC                                        │  │
│  │                                                        │  │
│  │  EC2 t3.small (2GB RAM)                                │  │
│  │  + Docker Compose : backend, frontend, postgres,       │  │
│  │    redis, prometheus, grafana                          │  │
│  │  + NGINX natif (TLS Certbot) + Elastic IP               │  │
│  │                                                        │  │
│  │  Port 80/443 ← Internet                                 │  │
│  │  Port 22 ← votre IP                                     │  │
│  └──────────────────────────────────────────────────────┘  │
│              │                                               │
│    Internet Gateway (gratuit)                                │
│                                                              │
│  (Le subnet privé existe toujours dans le module vpc/, mais │
│   plus aucune ressource n'y est déployée depuis la           │
│   suppression de RDS — c'était la seule occupante)           │
└──────────────────────────────────────────────────────────────┘
```

**Décision clé : tout sur une seule EC2, en subnet PUBLIC (pas besoin de NAT Gateway)**
- L'EC2 accède à internet (ECR, updates) via l'Internet Gateway directement
- PostgreSQL, Redis, Prometheus, Grafana tournent en conteneurs sur la même instance
- **Compromis assumé** : plus de séparation réseau app/DB, SPOF EC2/EBS unique — acceptable
  pour un portfolio personnel, mitigé par un backup quotidien hors-EC2 (S3)

---

## 5. Historique des coûts {#historique}

### Avant le 05/06/2026 — EC2 t2.micro + RDS (Free Tier actif)

Architecture d'origine du projet, entièrement Free Tier pendant les 12 premiers mois du
compte AWS : EC2 t2.micro + RDS db.t3.micro Single-AZ. Coût brut : **$0/mois**.

### 05/06/2026 — Recréation accidentelle de l'EC2 en t3.small

L'EC2 a été recréée (incident lors d'une mise à jour Lambda) et reconfigurée manuellement
avec NGINX + Certbot + Redis + Prometheus + Grafana en plus de l'app. Cette stack ne
rentre plus dans les 1GB RAM d'un t2/t3.micro → passage à t3.small, **hors Free Tier**.

### 14/06/2026 — Free Tier RDS expiré (anniversaire du compte AWS)

Confirmé via Cost Explorer : RDS et EC2 sont sortis du Free Tier. Coût brut estimé à
l'époque : **~$40-41/mois** (EC2 t3.small ~$16.5 + RDS ~$18 + VPC/EBS/Secrets ~$5-6).

### 23-24/07/2026 — Migration PostgreSQL RDS → conteneur, puis suppression de RDS

Décision : migrer PostgreSQL vers un conteneur Docker sur l'EC2 existante pour réduire la
facture, plutôt que de laisser le Free Tier expirer sans action. Séquence :
1. `pg_dump` RDS → restore dans un conteneur `postgres:15-alpine` sur l'EC2 (23-24/07).
2. Fenêtre de validation courte, puis décision explicite de l'utilisateur de sauter la
   fenêtre de 3-7 jours initialement prévue (blog personnel, risque jugé acceptable).
3. Snapshot RDS manuel pris par sécurité, puis suppression définitive de RDS et de son
   module Terraform (24/07/2026).
4. Mise en place d'un backup `pg_dump` quotidien vers S3 (systemd timer) pour remplacer
   les backups automatiques RDS.

**Coût brut résultant : ~$21-22/mois** (contre ~$40-41/mois avant migration), soit une
réduction d'environ 45-48%.

---

## 6. Checklist mensuelle de surveillance {#checklist}

À effectuer le 1er de chaque mois :

- [ ] **Vérifier la facture AWS Billing Console** — comparer au coût brut attendu (~$21-22)
- [ ] **Vérifier le solde des crédits AWS actifs** — Billing → Crédits (le solde et les
      dates d'expiration évoluent, ne pas se fier à un chiffre figé dans ce document)
- [ ] **Vérifier les EIP non attachées** — `aws ec2 describe-addresses`
- [ ] **Vérifier l'usage ECR** — ne pas dépasser 500MB
- [ ] **Vérifier que le backup pg_dump→S3 tourne** — `systemctl status portfolio-db-backup.timer` sur l'EC2, et présence de dumps récents dans `s3://portfolio-terraform-state-<account-id>/db-backups/`
- [ ] **Vérifier les logs CloudWatch** — pas de frais inattendus

### Script de surveillance rapide

```bash
#!/bin/bash
# Lancer ce script chaque mois pour vérifier l'état FinOps

echo "=== 1. EIP non attachées (coût potentiel: $3.60/mois chacune) ==="
aws ec2 describe-addresses \
  --query 'Addresses[?AssociationId==null].[PublicIp,AllocationId]' \
  --output table

echo ""
echo "=== 2. Instances EC2 en cours d'exécution ==="
aws ec2 describe-instances \
  --filters "Name=instance-state-name,Values=running" \
  --query 'Reservations[].Instances[].[InstanceId,InstanceType,LaunchTime]' \
  --output table

echo ""
echo "=== 3. Usage ECR (en bytes) ==="
aws ecr describe-repositories \
  --query 'repositories[].[repositoryName,createdAt]' \
  --output table

echo ""
echo "=== 4. Dernier backup PostgreSQL sur S3 ==="
aws s3 ls s3://portfolio-terraform-state-<account-id>/db-backups/ \
  --recursive | tail -5

echo ""
echo "=== 5. Coût estimé du mois en cours ==="
aws ce get-cost-and-usage \
  --time-period Start=$(date +%Y-%m-01),End=$(date +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --query 'ResultsByTime[].Total.BlendedCost.[Amount,Unit]' \
  --output table \
  --region us-east-1
```

> 📌 **Note :** il n'y a plus de commande `aws rds describe-db-instances` à faire tourner
> en routine — RDS a été supprimé le 24/07/2026. Une commande qui renverrait un résultat
> indiquerait une ressource RDS oubliée/recréée par erreur.

---

## 7. Commandes AWS CLI de monitoring {#commandes}

```bash
# Voir la facture du mois en cours
aws ce get-cost-and-usage \
  --time-period Start=2026-07-01,End=2026-07-31 \
  --granularity MONTHLY \
  --metrics "BlendedCost" "UsageQuantity" \
  --region us-east-1

# Confirmer qu'il n'y a plus d'instance RDS (doit renvoyer une liste vide)
aws rds describe-db-instances \
  --query 'DBInstances[].[DBInstanceIdentifier,DBInstanceClass,DBInstanceStatus]' \
  --output table

# Lister tous les volumes EBS (stockage payant après 30GB)
aws ec2 describe-volumes \
  --query 'Volumes[].[VolumeId,Size,State,CreateTime]' \
  --output table

# Lister les snapshots (coût $0.05/GB/mois) — inclut le snapshot RDS manuel conservé
# en filet de sécurité (portfolio-dev-postgres-final-manual-20260724)
aws ec2 describe-snapshots --owner self \
  --query 'Snapshots[].[SnapshotId,VolumeSize,StartTime,Description]' \
  --output table

aws rds describe-db-snapshots \
  --query 'DBSnapshots[].[DBSnapshotIdentifier,AllocatedStorage,SnapshotCreateTime]' \
  --output table
```

---

## 8. Décisions d'architecture guidées par les coûts {#decisions}

| Décision | Raison FinOps |
|----------|---------------|
| **Docker Compose sur EC2** (pas EKS) | EKS coûte $0.10/h = $72/mois pour le seul control plane |
| **PostgreSQL conteneurisé** (pas RDS) | ~$18/mois économisés depuis le 24/07/2026, au prix d'un SPOF assumé |
| **DuckDNS** (pas Route 53) | $0.50/zone/mois économisé |
| **Certbot + Let's Encrypt** (pas ACM+ALB) | ALB = $16/mois évité |
| **Subnet public** (pas NAT Gateway) | $32/mois évité |
| **ECR lifecycle policy** | Évite de dépasser 500MB gratuits |
| **EC2 t3.small** (accepté hors Free Tier) | Nécessaire pour faire tourner app + DB + cache + observabilité sur une seule instance |
| **1 seule instance EC2** | Simplicité maximale pour un portfolio personnel — le compromis SPOF est documenté et accepté |
| **Mode K3s laissé en Free Tier théorique** | Non déployé, donc son coût réel est $0 — voir PHASE20 pour ses hypothèses propres |

---

*Dernière mise à jour : 2026-07-24 — réécrit pour refléter l'architecture réelle post-suppression RDS*
*Région cible : eu-west-3 (Paris)*
*Compte AWS : amine.charrad@gmail.com*
