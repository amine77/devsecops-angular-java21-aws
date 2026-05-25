# FinOps — Analyse et Surveillance des Coûts AWS

> **Objectif :** Ne jamais avoir de surprise sur la facture AWS.
> Ce document centralise toutes les informations de coût pour le projet DevSecOps Portfolio.

## Table des matières
1. [Configuration des alertes de facturation](#alertes)
2. [Services utilisés et leur coût](#services)
3. [Pièges à éviter](#pieges)
4. [Architecture Free Tier choisie](#architecture)
5. [Estimation après 12 mois](#apres-12-mois)
6. [Checklist mensuelle de surveillance](#checklist)
7. [Commandes AWS CLI de monitoring](#commandes)

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

### 1.2 Créer un Budget d'alerte à $5

```
AWS Console → Billing → Budgets → Create Budget
→ Use a template → Monthly cost budget
→ Budget name : portfolio-monthly-limit
→ Budgeted amount : $5
→ Email recipients : amine.charrad@gmail.com
→ Alert threshold : 80% actual ($4.00)
→ Create budget
```

**Pourquoi $5 ?** Si on est en Free Tier, la facture devrait être $0. Tout dépassement de $4 indique une ressource mal configurée.

### 1.3 Alerte CloudWatch sur les coûts estimés

```bash
# Via AWS CLI — alerte si la facture estimée dépasse $10
aws cloudwatch put-metric-alarm \
  --alarm-name "BillingAlert-10USD" \
  --alarm-description "Alerte si cout mensuel > 10 USD" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 86400 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=Currency,Value=USD \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT_ID:billing-alert \
  --region us-east-1
```

> 📌 **Note :** Les métriques de facturation sont uniquement disponibles dans `us-east-1` (N. Virginia), même si vos ressources sont dans `eu-west-3`.

---

## 2. Services utilisés et leur coût {#services}

### 2.1 Tableau récapitulatif

| Service | Limite Free Tier | Notre usage | Coût Free Tier | Coût après 12 mois |
|---------|-----------------|-------------|----------------|--------------------|
| **EC2 t2.micro** | 750h/mois — 12 mois | 744h/mois (24/7) | **$0.00** | ~$8.47/mois (us-east-1) |
| **RDS PostgreSQL db.t3.micro** | 750h/mois + 20GB — 12 mois | 1 instance Single-AZ | **$0.00** | ~$16.50/mois |
| **ECR** | 500MB/mois — toujours | ~215MB (backend+frontend) | **$0.00** | ~$0.02/mois |
| **S3** (state Terraform) | 5GB + 20K GET/2K PUT — toujours | Quelques KB | **$0.00** | ~$0.00/mois |
| **VPC, Subnets, SG, IGW** | Toujours gratuits | Architecture de base | **$0.00** | **$0.00** |
| **Elastic IP** | Gratuite si attachée à EC2 running | 1 EIP sur notre t2.micro | **$0.00** | $0.00 (si EC2 tourne) |
| **IAM** | Toujours gratuit | Users, Roles, Policies | **$0.00** | **$0.00** |
| **DuckDNS** | Toujours gratuit | 1 sous-domaine | **$0.00** | **$0.00** |
| **Let's Encrypt (cert-manager)** | Toujours gratuit | Certificat TLS | **$0.00** | **$0.00** |
| **GitHub Actions** | 2000 min/mois — public repos illimité | CI/CD pipelines | **$0.00** | **$0.00** |

```
┌─────────────────────────────────────────────────────────────┐
│  TOTAL PENDANT 12 MOIS (Free Tier)   :   $0.00 / mois  ✅  │
│  TOTAL APRÈS 12 MOIS (pay-as-you-go) :  ~$25.00 / mois     │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Détail EC2 t2.micro

```
Free Tier : 750 heures / mois pendant 12 mois
           = 750 / 24 = 31,25 jours de fonctionnement continu
           = 1 mois civil de 31 jours : 744h < 750h → FREE ✅

Calcul si on dépasse :
  Prix on-demand us-east-1 : $0.0116/heure
  Prix on-demand eu-west-3 : $0.0126/heure (Paris — légèrement plus cher)
  Coût mensuel 24/7        : 744h × $0.0126 = $9.38/mois

⚠️ IMPORTANT : Le Free Tier couvre 750h CUMULÉES sur TOUS vos EC2 t2.micro.
Si vous lancez 2 instances t2.micro simultanément : 2 × 744h = 1488h > 750h
→ Vous payez les 738h excédentaires : ~$9.30
→ Solution : ne jamais avoir plus d'1 instance t2.micro active
```

### 2.3 Détail RDS db.t3.micro

```
Free Tier : 750 heures / mois + 20GB SSD + 20GB backup
           Uniquement en Single-AZ (Multi-AZ coûte le double et n'est pas free)

Prix après Free Tier (eu-west-3) :
  db.t3.micro Single-AZ : $0.023/heure = $16.56/mois
  Stockage gp2 20GB     : $0.115/GB/mois = $2.30/mois
  Total                 : ~$18.86/mois

Configuration obligatoire pour rester en Free Tier :
  ✅ db.t3.micro (pas db.t3.small ou plus grand)
  ✅ Single-AZ deployment
  ✅ 20GB de stockage maximum
  ✅ PostgreSQL (inclus dans Free Tier)
  ❌ Multi-AZ → JAMAIS en Free Tier
  ❌ Performance Insights → JAMAIS (coûte $0.02/vCPU/heure)
```

### 2.4 Détail ECR

```
Free Tier : 500MB de stockage PRIVÉ par compte (toujours, pas de limite 12 mois)

Nos images :
  portfolio-backend:latest  → ~190MB
  portfolio-frontend:latest → ~25MB
  Total                     → ~215MB < 500MB ✅

Si on garde plusieurs tags (latest + versions) :
  latest + v1.0.0 + v1.0.1 = 3 × 215MB = 645MB > 500MB
  Coût du dépassement : (645 - 500) × $0.10 = $0.0145/mois → quasi nul

Bonne pratique : lifecycle policy pour ne garder que les N derniers tags
  → Configuré dans les manifests Terraform (Phase 5)

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

## 3. Pièges à éviter — Services NON gratuits {#pieges}

Ces services **ne sont PAS couverts par le Free Tier** et auraient été des erreurs coûteuses :

| Service | Coût si utilisé | Alternative gratuite choisie |
|---------|----------------|------------------------------|
| **NAT Gateway** | $0.045/h + $0.045/GB = ~$32/mois | Subnet public direct + IGW |
| **Application Load Balancer (ALB)** | $0.008/h + LCU = ~$16/mois | NGINX Ingress sur K8s (dans EC2) |
| **Route 53 Hosted Zone** | $0.50/zone/mois | DuckDNS (gratuit) |
| **RDS Multi-AZ** | 2× prix Single-AZ | Single-AZ (portfolio, pas prod critique) |
| **EBS > 30GB** | $0.10/GB/mois au-delà de 30GB | Rester sous 30GB |
| **RDS Performance Insights** | $0.02/vCPU/heure | Désactivé par Terraform |
| **CloudTrail** | $2/100K events après Free Tier | Monitoring basique Actuator + CloudWatch |
| **Secrets Manager** | $0.40/secret/mois | K8s Secrets + env vars (acceptable pour portfolio) |

### Économies réalisées par nos choix d'architecture

```
NAT Gateway évité        : -$32/mois
ALB évité                : -$16/mois
Route 53 évité           : -$0.50/mois
RDS Multi-AZ évité       : -$18/mois
                          ──────────
Économies totales        : ~$66.50/mois
```

---

## 4. Architecture Free Tier choisie {#architecture}

```
┌──────────────────────────────────────────────────────────────┐
│                    VPC (10.0.0.0/16)                         │
│                                                              │
│  ┌─────────────────────────────┐  ┌────────────────────────┐ │
│  │  Subnet PUBLIC              │  │  Subnet PRIVATE        │ │
│  │  10.0.1.0/24                │  │  10.0.2.0/24           │ │
│  │                             │  │                        │ │
│  │  EC2 t2.micro               │  │  RDS db.t3.micro       │ │
│  │  + Docker                   │  │  PostgreSQL 15         │ │
│  │  + Minikube                 │  │  Single-AZ             │ │
│  │  + Helm                     │  │  20GB gp2              │ │
│  │  + NGINX Ingress            │  │                        │ │
│  │  + Elastic IP               │  │  Port 5432 ouvert      │ │
│  │                             │  │  UNIQUEMENT depuis     │ │
│  │  Port 80/443 ← Internet     │  │  le SG de l'EC2        │ │
│  │  Port 22 ← votre IP         │  │                        │ │
│  └─────────────────────────────┘  └────────────────────────┘ │
│              │                                               │
│    Internet Gateway (gratuit)                                │
└──────────────────────────────────────────────────────────────┘
```

**Décision clé : EC2 en subnet PUBLIC (pas besoin de NAT Gateway)**
- L'EC2 accède à internet (ECR, updates) via l'Internet Gateway directement
- La RDS est en subnet PRIVÉ mais accessible depuis l'EC2 via Security Group
- La RDS n'a PAS besoin d'accès internet (pas de NAT Gateway nécessaire)
- **Économie : $32/mois de NAT Gateway évité**

---

## 5. Estimation des coûts après 12 mois {#apres-12-mois}

### Option A : Garder l'architecture actuelle (pay-as-you-go)

```
EC2 t2.micro (eu-west-3)     :  $9.38/mois
RDS db.t3.micro (eu-west-3)  : $18.86/mois
ECR (2 repos ~215MB)         :  $0.02/mois
S3 (state Terraform)         :  $0.00/mois
Transfert réseau (faible)    :  $0.00/mois
                               ───────────
Total                        : ~$28.26/mois (~$339/an)
```

### Option B : Éteindre quand non utilisé (économie 70%)

```
EC2 arrêtée 70% du temps (nuit + week-ends) :
  744h × 30% × $0.0126 = $2.82/mois
RDS arrêtée en même temps                  : $5.66/mois
                                             ──────────
Total                                      :  ~$8.50/mois

⚠️ EIP doit être libérée si EC2 arrêtée > quelques heures
   ou le coût de l'EIP s'ajoute ($3.60/mois)
```

### Option C : Migrer vers Lightsail (alternative simple après 12 mois)

```
AWS Lightsail $5/mois :
  1 vCPU, 1GB RAM, 40GB SSD, 1TB transfert
  → Remplace EC2 + EBS + réseau dans un forfait simple
  → Mais pas de RDS → utiliser PostgreSQL sur Lightsail directement

Lightsail $5/mois total → option la plus économique hors Free Tier
```

---

## 6. Checklist mensuelle de surveillance {#checklist}

À effectuer le 1er de chaque mois :

- [ ] **Vérifier la facture AWS Billing Console** — s'assurer qu'elle est $0 (Free Tier)
- [ ] **Vérifier les EIP non attachées** — `aws ec2 describe-addresses`
- [ ] **Vérifier l'usage ECR** — ne pas dépasser 500MB
- [ ] **Vérifier les snapshots RDS automatiques** — supprimer les anciens si > 20GB
- [ ] **Vérifier les logs CloudWatch** — pas de frais inattendus
- [ ] **Vérifier la date d'expiration du Free Tier** — 12 mois depuis la création du compte

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
echo "=== 3. Instances RDS en cours d'exécution ==="
aws rds describe-db-instances \
  --query 'DBInstances[].[DBInstanceIdentifier,DBInstanceClass,DBInstanceStatus]' \
  --output table

echo ""
echo "=== 4. Usage ECR (en bytes) ==="
aws ecr describe-repositories \
  --query 'repositories[].[repositoryName,createdAt]' \
  --output table

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

---

## 7. Commandes AWS CLI de monitoring {#commandes}

```bash
# Voir la facture du mois en cours
aws ce get-cost-and-usage \
  --time-period Start=2026-05-01,End=2026-05-31 \
  --granularity MONTHLY \
  --metrics "BlendedCost" "UsageQuantity" \
  --region us-east-1

# Voir l'usage Free Tier restant
aws freetier get-free-tier-usage \
  --query 'freeTierUsages[?forecastedUsageAmount > actualUsageAmount]' \
  --output table 2>/dev/null \
  || echo "Free Tier API requires additional permissions"

# Lister tous les volumes EBS (stockage payant après 30GB)
aws ec2 describe-volumes \
  --query 'Volumes[].[VolumeId,Size,State,CreateTime]' \
  --output table

# Lister les snapshots (coût $0.05/GB/mois)
aws ec2 describe-snapshots --owner self \
  --query 'Snapshots[].[SnapshotId,VolumeSize,StartTime,Description]' \
  --output table

# Vérifier si RDS est en Multi-AZ (ne devrait PAS l'être)
aws rds describe-db-instances \
  --query 'DBInstances[].[DBInstanceIdentifier,MultiAZ,DBInstanceClass]' \
  --output table
```

---

## 8. Décisions d'architecture guidées par les coûts

| Décision | Raison FinOps |
|----------|---------------|
| **Minikube sur EC2** (pas EKS) | EKS coûte $0.10/h = $72/mois pour le cluster control plane |
| **DuckDNS** (pas Route 53) | $0.50/zone/mois économisé |
| **cert-manager + Let's Encrypt** (pas ACM+ALB) | ALB = $16/mois évité |
| **Subnet public** (pas NAT Gateway) | $32/mois évité |
| **Single-AZ RDS** (pas Multi-AZ) | $18/mois économisé |
| **ECR lifecycle policy** | Évite de dépasser 500MB gratuits |
| **t2.micro** (pas t3.small ou plus) | Reste dans le Free Tier |
| **1 seule instance EC2** | Le Free Tier est partagé entre toutes les instances |

---

*Dernière mise à jour : 2026-05-25*
*Région cible : eu-west-3 (Paris)*
*Compte AWS : amine.charrad@gmail.com*
