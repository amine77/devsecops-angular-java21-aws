# Phase 19 — Helm Charts

## Objectif

Packager l'application sous forme de **Helm Chart** pour remplacer les manifests
Kustomize bruts. Helm apporte le templating, la gestion des releases, le rollback
natif et une syntaxe standardisée pour les paramètres d'environnement.

---

## Kustomize vs Helm — Quand utiliser quoi ?

| Critère | Kustomize | Helm |
|---|---|---|
| **Paradigme** | Patch/Overlay | Template/Values |
| **Templating** | Non (patches uniquement) | Oui (`{{ .Values.x }}`) |
| **Logique conditionnelle** | Non | Oui (`{{- if .Values.hpa.enabled }}`) |
| **Release management** | Non | Oui (`helm history`, `helm rollback`) |
| **Dépendances** | Non | Oui (subchart) |
| **Courbe d'apprentissage** | Faible | Moyenne |
| **Standard industrie** | Croissant | Dominant |
| **ArgoCD support** | Natif | Natif |

**Choix pour ce projet** : Helm pour la flexibilité et la lisibilité.
Kustomize reste disponible dans `k8s/overlays/` comme référence.

---

## Structure du chart

```
helm/portfolio/
├── Chart.yaml              # Métadonnées (nom, version, appVersion)
├── .helmignore             # Fichiers exclus du package
├── values.yaml             # Valeurs par défaut (commun à tous les envs)
├── values-dev.yaml         # Overrides dev (1 replica, tag SHA auto-mis à jour)
├── values-prod.yaml        # Overrides prod (3 replicas, TLS, HPA, PDB)
└── templates/
    ├── _helpers.tpl        # Fonctions réutilisables (labels, noms, images)
    ├── NOTES.txt           # Message post-install (affiché par helm install)
    ├── backend/
    │   ├── deployment.yaml # Spring Boot — probes, securityContext, anti-affinité
    │   ├── service.yaml    # ClusterIP
    │   └── configmap.yaml  # Variables non-sensibles (itère sur values.backend.config)
    ├── frontend/
    │   ├── deployment.yaml # NGINX non-root, readOnly FS, volumes emptyDir
    │   └── service.yaml    # ClusterIP
    ├── ingress.yaml        # NGINX path-based avec TLS conditionnel
    ├── hpa.yaml            # HorizontalPodAutoscaler (activé si hpa.enabled=true)
    └── pdb.yaml            # PodDisruptionBudget (activé si pdb.enabled=true)
```

---

## Fonctionnalités clés

### 1. Helpers (`_helpers.tpl`)

Les helpers évitent la duplication dans les templates :

```yaml
# Utilisation dans deployment.yaml
image: {{ include "portfolio.backendImage" . }}
# Rendu : 123456789.dkr.ecr.eu-west-3.amazonaws.com/portfolio-backend:sha-abc1234

labels:
  {{- include "portfolio.backendLabels" . | nindent 4 }}
# Rendu :
#   helm.sh/chart: portfolio-1.0.0
#   app.kubernetes.io/name: portfolio
#   app.kubernetes.io/component: backend
#   app.kubernetes.io/managed-by: Helm
```

### 2. Ressources conditionnelles

HPA et PDB ne s'appliquent qu'en prod grâce à `{{- if .Values.hpa.enabled }}` :

```yaml
# values-dev.yaml
hpa:
  enabled: false   # Pas de HPA en dev

# values-prod.yaml
hpa:
  enabled: true
  backend:
    minReplicas: 2
    maxReplicas: 8
```

### 3. Checksum ConfigMap

Le deployment redémarre automatiquement quand la config change :

```yaml
annotations:
  checksum/config: {{ include (print $.Template.BasePath "/backend/configmap.yaml") . | sha256sum }}
```

ArgoCD détecte le changement de checksum → rolling update automatique.

### 4. TLS conditionnel

```yaml
# ingress.yaml
{{- if .Values.ingress.tls.enabled }}
tls:
  - hosts:
      - {{ .Values.ingress.host }}
    secretName: {{ .Values.ingress.tls.secretName }}
{{- end }}
```

---

## Intégration ArgoCD + Helm

ArgoCD gère nativement les charts Helm sans plugin externe :

```yaml
# argocd/apps/portfolio-dev.yaml
source:
  path: helm/portfolio
  helm:
    valueFiles:
      - values.yaml        # Valeurs de base
      - values-dev.yaml    # Overrides dev (tag SHA)
    releaseName: portfolio
```

ArgoCD fusionne les values dans l'ordre et génère les manifests en mémoire.
Il n'exécute pas `helm install` mais `helm template` → `kubectl apply`.

---

## Workflow GitOps avec Helm (ci-gitops.yml)

### Avant (Kustomize)
```bash
kustomize edit set image portfolio-backend=<ECR>:sha-XXXX
# Modifiait : k8s/overlays/dev/kustomization.yaml
```

### Après (Helm + yq)
```bash
yq e '.backend.image.tag = "sha-XXXX"' -i helm/portfolio/values-dev.yaml
yq e '.frontend.image.tag = "sha-XXXX"' -i helm/portfolio/values-dev.yaml
# Modifie : helm/portfolio/values-dev.yaml
```

`yq` est préféré à `sed` car il comprend la structure YAML :
- Préserve les commentaires
- Type-safe (ne remplace pas `tag` dans un autre contexte)
- Idempotent

---

## Commandes utiles

```bash
# Linter le chart (valide la syntaxe et les bonnes pratiques)
helm lint helm/portfolio/ -f helm/portfolio/values-dev.yaml

# Afficher les manifests générés sans déployer (dry-run)
helm template portfolio helm/portfolio/ \
  -f helm/portfolio/values.yaml \
  -f helm/portfolio/values-dev.yaml \
  --namespace portfolio-dev

# Installer en dev
helm upgrade --install portfolio helm/portfolio/ \
  -f helm/portfolio/values.yaml \
  -f helm/portfolio/values-dev.yaml \
  --namespace portfolio-dev \
  --create-namespace \
  --atomic \
  --timeout 5m

# Voir l'historique des releases
helm history portfolio -n portfolio-dev

# Rollback à la révision précédente
helm rollback portfolio 0 -n portfolio-dev
# (0 = révision précédente)

# Désinstaller
helm uninstall portfolio -n portfolio-dev

# Debug — afficher les valeurs résolues
helm get values portfolio -n portfolio-dev
```

---

## Promotion Dev → Prod

```bash
# 1. Récupérer le tag validé en dev
TAG=$(helm get values portfolio -n portfolio-dev -o json | jq -r '.backend.image.tag')

# 2. Mettre à jour values-prod.yaml
yq e ".backend.image.tag  = \"$TAG\"" -i helm/portfolio/values-prod.yaml
yq e ".frontend.image.tag = \"$TAG\"" -i helm/portfolio/values-prod.yaml

# 3. Committer
git add helm/portfolio/values-prod.yaml
git commit -m "chore(gitops): promote $TAG to prod"
git push origin main

# 4. ArgoCD détecte le diff mais attend la sync manuelle (prod)
argocd app sync portfolio-prod
```

---

## Références

- [Helm Documentation](https://helm.sh/docs/)
- [Helm Best Practices](https://helm.sh/docs/chart_best_practices/)
- [ArgoCD + Helm](https://argo-cd.readthedocs.io/en/stable/user-guide/helm/)
- [yq — YAML processor](https://mikefarah.gitbook.io/yq/)
- [Helm Chart Testing (ct)](https://github.com/helm/chart-testing)
