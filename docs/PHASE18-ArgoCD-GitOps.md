# Phase 18 — GitOps avec ArgoCD

## Objectif

Remplacer le modèle de déploiement **push** (CI/CD → SSH → kubectl) par le modèle
**pull** (GitOps) où ArgoCD surveille le dépôt Git et réconcilie automatiquement
l'état du cluster Kubernetes avec l'état décrit dans Git.

---

## Push vs Pull — Comparaison

| Critère | Push (deploy-app.yml) | Pull / GitOps (ci-gitops.yml + ArgoCD) |
|---|---|---|
| **Source de vérité** | Pipeline CI | Git |
| **Credentials K8s dans CI** | Oui (risque) | Non (ArgoCD est dans le cluster) |
| **Rollback** | Redéploiement manuel | `git revert` + commit |
| **Drift detection** | Non | Oui — ArgoCD réconcilie si dérive |
| **Audit trail** | Logs CI | Historique Git + ArgoCD history |
| **Multi-env** | Complexe (branches/tags) | Simple (overlays Kustomize) |
| **Scalabilité** | Difficile | Natif (un ArgoCD, N clusters) |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                 GitHub (source de vérité)            │
│                                                     │
│  main branch                                        │
│  ├── k8s/                                           │
│  │   ├── base/           ← Manifests communs        │
│  │   └── overlays/                                  │
│  │       ├── dev/        ← newTag: sha-XXXXXXX ◄── CI met à jour
│  │       └── prod/       ← newTag: sha-YYYYYYY      │
│  └── argocd/apps/                                   │
│      ├── app-of-apps.yaml                           │
│      ├── portfolio-dev.yaml                         │
│      └── portfolio-prod.yaml                        │
└───────────────────┬─────────────────────────────────┘
                    │ polling (3 min) ou webhook
                    ▼
┌─────────────────────────────────────────────────────┐
│              ArgoCD (dans le cluster)                │
│                                                     │
│  App of Apps ──► portfolio-dev ──► k8s/overlays/dev │
│               └► portfolio-prod ► k8s/overlays/prod  │
│                                                     │
│  Détecte diff → kubectl apply -k → Rolling update   │
└─────────────────────────────────────────────────────┘
```

---

## Pattern App of Apps

L'**App of Apps** est une Application ArgoCD qui gère d'autres Applications.
C'est le point d'entrée unique pour tout l'environnement.

```
argocd apply app-of-apps.yaml
         │
         ▼ ArgoCD lit argocd/apps/ dans Git
         ├── portfolio-dev.yaml  → Application dev
         └── portfolio-prod.yaml → Application prod
```

Avantages :
- **Bootstrap en une commande** : `kubectl apply -f argocd/apps/app-of-apps.yaml`
- **Évolutif** : ajouter un environnement = ajouter un fichier YAML dans `argocd/apps/`
- **DRY** : la configuration ArgoCD elle-même est dans Git

---

## Kustomize — Structure des overlays

```
k8s/
├── base/                          ← Manifests partagés (ne pas modifier directement)
│   ├── backend/
│   │   ├── deployment.yaml        ← image: portfolio-backend:latest (placeholder)
│   │   ├── service.yaml
│   │   └── configmap.yaml
│   ├── frontend/
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   └── ingress.yaml
└── overlays/
    ├── dev/
    │   ├── kustomization.yaml     ← images.newTag mis à jour par CI
    │   └── patches/
    │       ├── replicas.yaml      ← 1 replica en dev
    │       └── ingress-host.yaml  ← portfolio-dev.local
    └── prod/
        ├── kustomization.yaml
        └── patches/
            ├── replicas.yaml      ← 3 replicas backend
            ├── frontend-replicas.yaml ← 2 replicas frontend
            ├── backend-resources.yaml ← limits plus élevées
            └── ingress-host.yaml  ← portfolio.amine-charrad.dev + TLS
```

### Principe de surcharge Kustomize

```yaml
# k8s/overlays/dev/kustomization.yaml
images:
  - name: portfolio-backend
    newName: 123456789.dkr.ecr.eu-west-3.amazonaws.com/portfolio-backend
    newTag: sha-abc1234        # ← CI met à jour cette ligne
```

La commande CI :
```bash
kustomize edit set image \
  portfolio-backend=<ECR_REGISTRY>/portfolio-backend:sha-abc1234
```

---

## Workflow GitOps (ci-gitops.yml)

### Flux complet

```
push main (backend/ ou frontend/)
          │
          ▼
check-prerequisites
  └─ AWS_ACCESS_KEY_ID présent ? ──non──► skip (⏭️ gris)
          │ oui
          ▼
build-push-backend  ┐ (parallèle)
build-push-frontend ┘
  ├── docker build + Trivy scan
  └── docker push ECR : sha-XXXXXXX + latest
          │
          ▼
update-k8s-manifest
  ├── kustomize edit set image backend=...sha-XXXXXXX
  ├── kustomize edit set image frontend=...sha-XXXXXXX
  └── git commit + push → main
                │
                ▼ (ArgoCD polling ~3min)
        ArgoCD détecte le diff dans k8s/overlays/dev/kustomization.yaml
                │
                ▼
        kubectl apply -k k8s/overlays/dev/
                │
                ▼
        Rolling update (0 downtime — maxUnavailable: 0)
```

### Clé technique : GITOPS_TOKEN

Le workflow doit committer dans `main` après avoir mis à jour le manifest.
`GITHUB_TOKEN` ne peut pas déclencher d'autres workflows (protection GitHub).
Un **Personal Access Token** `GITOPS_TOKEN` avec `repo:write` est requis.

```bash
# Créer le PAT : GitHub → Settings → Developer settings → PAT (classic)
# Scopes : repo (full)
# Ajouter comme secret : Settings → Secrets → Actions → GITOPS_TOKEN
```

---

## Sécurité GitOps

### Pas de credentials Kubernetes dans GitHub

Dans le modèle push, le CI avait besoin d'une kubeconfig ou d'un token de service
pour exécuter `kubectl`. En GitOps :
- ArgoCD est **dans** le cluster et a les permissions nécessaires localement
- GitHub ne connaît pas le cluster — il ne peut que committer dans Git
- Surface d'attaque réduite : une fuite de GITHUB_TOKEN ne donne pas accès au cluster

### Environnements séparés

| Environnement | Sync ArgoCD | Prune | SelfHeal |
|---|---|---|---|
| `dev` | **Automatique** | ✅ | ✅ |
| `prod` | **Manuel** (approbation) | ✅ | ✅ |

La prod nécessite un opérateur humain :
```bash
argocd app sync portfolio-prod
```

### Network Policies (à ajouter)

```yaml
# Recommandation : ajouter une NetworkPolicy pour isoler les pods
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-netpol
  namespace: portfolio-dev
spec:
  podSelector:
    matchLabels:
      app: portfolio-backend
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: portfolio-frontend
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
```

---

## Promotion Dev → Prod

Le workflow de promotion met à jour l'overlay prod avec le tag validé en dev.

```bash
# Manuel (CLI)
cd k8s/overlays/prod
kustomize edit set image \
  portfolio-backend=<ECR>/portfolio-backend:sha-abc1234
git commit -m "chore(gitops): promote sha-abc1234 to prod"
git push origin main

# ArgoCD détecte le changement mais attend la validation manuelle
argocd app sync portfolio-prod  # Déclenche le déploiement
```

---

## Commandes utiles

```bash
# État des applications
argocd app list

# Détail d'une application
argocd app get portfolio-dev

# Forcer une synchronisation
argocd app sync portfolio-dev

# Historique des déploiements
argocd app history portfolio-dev

# Rollback vers une révision précédente
argocd app rollback portfolio-dev 5

# Vérifier le diff entre Git et le cluster
argocd app diff portfolio-dev

# Désactiver la sync automatique temporairement (maintenance)
argocd app set portfolio-dev --sync-policy none

# Ré-activer
argocd app set portfolio-dev --sync-policy automated
```

---

## Références

- [ArgoCD Documentation](https://argo-cd.readthedocs.io)
- [Kustomize Reference](https://kubectl.docs.kubernetes.io/references/kustomize/)
- [App of Apps Pattern](https://argo-cd.readthedocs.io/en/stable/operator-manual/cluster-bootstrapping/)
- [GitOps Principles — OpenGitOps](https://opengitops.dev/)
- [CNCF GitOps Working Group](https://github.com/cncf/tag-app-delivery/tree/main/gitops-wg)
