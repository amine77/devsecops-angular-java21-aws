# Phase 21 — External Secrets Operator

## Objectif

Remplacer la création manuelle de Kubernetes Secrets (`kubectl create secret`) par
**External Secrets Operator (ESO)** qui synchronise automatiquement les secrets depuis
**AWS Secrets Manager** vers des Kubernetes Secrets.

Résultat : **zéro secret en clair dans Git, dans user_data, ou dans les manifests K8s**.

---

## Avant / Après

### Avant (Phase 20)
```bash
# Dans user-data-k3s.sh.tpl — secret en clair dans user_data
kubectl create secret generic portfolio-secrets \
  --from-literal=db-password="$DB_PASSWORD" \
  --from-literal=jwt-secret="$JWT_SECRET"

# DB_PASSWORD et JWT_SECRET viennent de terraform.tfvars
# → visible dans les logs AWS CloudTrail + terraform.tfstate
```

### Après (Phase 21)
```
AWS Secrets Manager
  └── portfolio/dev  { "db-password": "...", "jwt-secret": "..." }
        ↓ sync toutes les 1h (IAM Instance Profile)
External Secrets Operator (K3s, namespace external-secrets)
        ↓ crée automatiquement
Kubernetes Secret "portfolio-secrets" (portfolio-dev, portfolio-prod)
        ↓ monté dans les pods
Spring Boot — lit db-password, jwt-secret via secretKeyRef
```

---

## Architecture complète

```
┌─────────────────────────────────────────────────────────────────┐
│  AWS (Terraform gère la création des secrets)                   │
│                                                                 │
│  Secrets Manager                                                │
│  ├── portfolio/dev  {JSON: db-url, db-password, jwt-secret...} │
│  └── portfolio/prod {JSON: ...}                                 │
│                                                                 │
│  IAM Instance Profile EC2                                       │
│  └── secretsmanager:GetSecretValue sur portfolio/*              │
└────────────────────┬────────────────────────────────────────────┘
                     │ IMDS (Instance Metadata Service)
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│  K3s Cluster                                                    │
│                                                                 │
│  namespace: external-secrets                                    │
│  ├── ESO Controller (Helm chart v0.10.x)                       │
│  ├── ESO Webhook                                                │
│  └── ClusterSecretStore "aws-secrets-manager"                   │
│         (pointe vers eu-west-3, auth: Instance Profile)         │
│                                                                 │
│  namespace: portfolio-dev                                       │
│  ├── ExternalSecret "portfolio-secrets"                         │
│  │     refreshInterval: 1h                                      │
│  │     remoteRef: portfolio/dev (JSON properties)               │
│  └── Secret "portfolio-secrets" ← CRÉÉ AUTOMATIQUEMENT        │
│         db-url, db-username, db-password, jwt-secret, redis-host│
│                                                                 │
│  namespace: portfolio-prod  (idem avec portfolio/prod)         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Ordre de déploiement ArgoCD (SyncWaves)

Les **sync-waves** ArgoCD garantissent l'ordre de création :

```
Wave 0 : external-secrets-operator.yaml
         → Helm chart ESO installé (CRDs créés)
         → Attente que le controller ESO soit Ready

Wave 1 : portfolio-secrets.yaml (Application ArgoCD)
         → ClusterSecretStore "aws-secrets-manager" créé
         → (dépend des CRDs ESO de la wave 0)

Wave 2 : ExternalSecrets (dans k8s/external-secrets/)
         → portfolio-secrets créés dans portfolio-dev + portfolio-prod
         → (dépend du ClusterSecretStore de la wave 1)

(Continu) : portfolio-dev.yaml
            → Helm chart déployé (utilise les Secrets créés par ESO)
```

Sans sync-waves, l'ExternalSecret référencerait un ClusterSecretStore qui
n'existe pas encore → erreur de synchronisation ArgoCD.

---

## Fichiers créés

```
terraform/
├── modules/secrets-manager/
│   ├── main.tf           → aws_secretsmanager_secret + versions (dev + prod)
│   ├── variables.tf      → rds_host, db_username, db_password, jwt_secret
│   └── outputs.tf        → ARNs et noms des secrets
├── modules/ec2/main.tf   → IAM policy secretsmanager:GetSecretValue portfolio/*
└── main.tf               → module secrets_manager ajouté

k8s/external-secrets/
├── clusterSecretStore.yaml  → Connexion AWS Secrets Manager (IAM Instance Profile)
├── externalSecret-dev.yaml  → Sync portfolio/dev → portfolio-dev/portfolio-secrets
├── externalSecret-prod.yaml → Sync portfolio/prod → portfolio-prod/portfolio-secrets
└── kustomization.yaml

argocd/apps/
├── external-secrets-operator.yaml  → Helm chart ESO (wave 0)
└── portfolio-secrets.yaml          → ClusterSecretStore + ExternalSecrets (wave 1)
```

---

## Commandes de vérification

```bash
# Voir le statut du ClusterSecretStore
kubectl get clustersecretstore aws-secrets-manager -o yaml
# Status.conditions[0].type: Ready
# Status.conditions[0].status: "True"

# Voir le statut de l'ExternalSecret
kubectl get externalsecret portfolio-secrets -n portfolio-dev
# NAME                STORE                  REFRESH INTERVAL   STATUS
# portfolio-secrets   aws-secrets-manager    1h                 SecretSynced

# Voir le Secret K8s créé par ESO
kubectl get secret portfolio-secrets -n portfolio-dev -o yaml
# (les valeurs sont en base64 — décoder avec | base64 -d)

# Forcer un refresh immédiat (sans attendre 1h)
kubectl annotate externalsecret portfolio-secrets \
  force-sync=$(date +%s) \
  -n portfolio-dev

# Voir les events ESO (debug)
kubectl describe externalsecret portfolio-secrets -n portfolio-dev

# Voir les logs du controller ESO
kubectl logs -n external-secrets \
  deployment/external-secrets -c external-secrets
```

---

## Rotation des secrets

Grâce à `refreshInterval: 1h`, si le secret est modifié dans AWS Secrets Manager :

```bash
# 1. Mettre à jour le secret dans AWS
aws secretsmanager update-secret \
  --secret-id portfolio/dev \
  --secret-string '{"db-password":"NouveauMotDePasse","jwt-secret":"...", ...}'

# 2. ESO détecte le changement au prochain refresh (max 1h)
#    OU forcer immédiatement :
kubectl annotate externalsecret portfolio-secrets \
  force-sync=$(date +%s) -n portfolio-dev

# 3. Kubernetes met à jour le Secret portfolio-secrets

# 4. Le pod Spring Boot rechargera les valeurs au prochain redémarrage
#    (ou avec Spring Cloud Config si rechargement à chaud configuré)
```

---

## Avantages sur le CV

- **Zéro secret en clair** : ni dans Git, ni dans user_data, ni dans les logs
- **Rotation sans redéploiement** : modifier le secret dans AWS suffit
- **Audit trail complet** : chaque lecture de secret est loggée dans CloudTrail
- **Pattern IRSA-like** : auth via IAM Instance Profile (même principe que IRSA sur EKS)
- **Standard industrie** : ESO est le leader des solutions secrets K8s (15k+ stars GitHub)

---

## Références

- [External Secrets Operator](https://external-secrets.io)
- [ESO AWS Provider](https://external-secrets.io/latest/provider/aws-secrets-manager/)
- [SyncWaves ArgoCD](https://argo-cd.readthedocs.io/en/stable/user-guide/sync-waves/)
- [AWS Secrets Manager Pricing](https://aws.amazon.com/secrets-manager/pricing/)
