# Installation ArgoCD

## Prérequis
- Cluster Kubernetes (EKS, K3s, Minikube, kind)
- `kubectl` configuré
- `helm` v3+

## 1. Installer ArgoCD

```bash
# Namespace dédié
kubectl create namespace argocd

# Installation stable (version 2.10+)
kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Attendre que tous les pods soient Running
kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=argocd-server \
  -n argocd --timeout=120s
```

## 2. Accéder à l'interface

```bash
# Port-forward vers l'UI
kubectl port-forward svc/argocd-server -n argocd 8082:443

# Récupérer le mot de passe admin initial
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d && echo

# Ouvrir https://localhost:8082 (admin / <mot de passe>)
```

## 3. Déployer l'App of Apps

```bash
# Connecter ArgoCD CLI
argocd login localhost:8082 --insecure

# Appliquer l'App of Apps (racine de tout)
kubectl apply -f argocd/apps/app-of-apps.yaml

# Vérifier
argocd app list
argocd app sync portfolio-app-of-apps
```

## 4. Créer les secrets Kubernetes

ArgoCD ne gère pas les secrets sensibles — ils doivent être créés manuellement
ou via un gestionnaire de secrets (External Secrets Operator, Vault, AWS Secrets Manager).

```bash
# Namespace dev
kubectl create namespace portfolio-dev

kubectl create secret generic portfolio-secrets \
  --namespace portfolio-dev \
  --from-literal=db-url="jdbc:postgresql://<RDS_ENDPOINT>:5432/portfolio" \
  --from-literal=db-username="portfolio_user" \
  --from-literal=db-password="<CHANGE_ME>" \
  --from-literal=jwt-secret="<CHANGE_ME_32_CHARS_MIN>" \
  --from-literal=redis-host="<REDIS_HOST>"

# Répéter pour portfolio-prod
```

## 5. Vérifier le déploiement

```bash
# Statut des applications
argocd app get portfolio-dev
argocd app get portfolio-prod

# Historique des syncs
argocd app history portfolio-dev

# Rollback si besoin
argocd app rollback portfolio-dev <REVISION_ID>
```

## Architecture GitOps

```
Push vers main
    ↓
GitHub Actions (ci-gitops.yml)
    ├── Build + push image ECR
    └── Commit : kustomize edit set image ...sha-XXXX
                    ↓
               Git (main)
                    ↓ surveillance (polling 3min ou webhook)
              ArgoCD détecte le diff
                    ↓
         kubectl apply -k k8s/overlays/dev/
                    ↓
           Pods rolling update (0 downtime)
```
