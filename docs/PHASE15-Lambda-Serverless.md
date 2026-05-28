# Phase 15 — AWS Lambda & Architecture Serverless

## Vue d'ensemble

| Fonction | Déclencheur | Runtime | Mémoire | Timeout | Coût/mois |
|---|---|---|---|---|---|
| `weekly-report` | EventBridge Scheduler (lun. 8h UTC) | Node.js 20.x | 128 MB | 30s | $0 |
| `image-resize` | S3 PutObject (`originals/`) | Node.js 20.x | 512 MB | 60s | $0 |
| `contact-form` | API Gateway HTTP POST `/contact` | Node.js 20.x | 128 MB | 15s | $0 |

Les trois fonctions restent dans le **Free Tier AWS à vie** (1M req/mois, 400k GB-s/mois).

---

## 1. Philosophie serverless — Pourquoi Lambda ici ?

Le backend principal (Spring Boot sur EC2) est persistant et stateful : il maintient des connexions DB, un pool HikariCP, une connexion Redis. Ce modèle est approprié pour une API REST.

Lambda répond à un besoin différent : des **opérations ponctuelles, sans état, pilotées par des événements**. La règle appliquée dans ce projet :

> **Lambda si** : l'opération est déclenchée par un événement externe, ne nécessite pas d'état entre deux exécutions, et n'a aucune raison de tourner en continu.

| Question | `weekly-report` | `image-resize` | `contact-form` |
|---|---|---|---|
| Déclenché par un événement ? | ✅ Timer | ✅ Upload S3 | ✅ Appel HTTP |
| Nécessite un état persistant ? | ❌ | ❌ | ❌ |
| Sens de le faire en Spring Boot ? | ❌ (démarrage à froid ~8s) | ❌ (overkill) | ❌ (pas de DB) |
| Lambda approprié ? | ✅ | ✅ | ✅ |

---

## 2. Fonction 1 — Rapport hebdomadaire

### Architecture

```
EventBridge Scheduler
  cron(0 8 ? * MON *)       ← Tous les lundis à 8h00 UTC
        │
        ▼ InvokeFunction
  Lambda: portfolio-dev-weekly-report
  Runtime: Node.js 20.x ESM
  Memory: 128 MB | Timeout: 30s
        │
        ├── fetch() → GET {EC2_IP}/api/v1/projects?page=0&size=100
        │             (endpoint public, pas d'auth requise)
        │
        └── SESClient.SendEmailCommand
              From:    noreply@domaine.com    ← SES vérifié
              To:      admin@gmail.com        ← SES vérifié (sandbox)
              Subject: "Rapport Portfolio — lundi 29 mai 2026"
              Body:    HTML + text/plain
        │
        ▼
  CloudWatch Logs (rétention 7j)
```

### Contenu du rapport

Le rapport HTML généré contient :
- Compteurs : projets actifs / en vedette / archivés
- Liste des projets en vedette avec titre et résumé
- Liste des autres projets actifs
- Footer : "Généré par AWS Lambda + EventBridge Scheduler"

### IAM (principe du moindre privilège)

```json
{
  "Effect": "Allow",
  "Action": ["ses:SendEmail", "ses:SendRawEmail"],
  "Resource": "*"
}
```

La Lambda n'a accès qu'à SES. Elle ne peut pas lire la DB, écrire dans S3, ou invoquer d'autres services.

### SES Sandbox

En mode sandbox SES (par défaut), **les deux adresses** (expéditeur et destinataire) doivent être vérifiées manuellement :

```bash
make ses-verify SENDER_EMAIL=noreply@domaine.com RECIPIENT_EMAIL=admin@gmail.com
```

Pour un déploiement production : demander la sortie du sandbox SES dans la console AWS (formulaire de 2 min, approuvé en quelques heures).

### Test manuel

```bash
# Invoque la Lambda immédiatement sans attendre le scheduler
make lambda-invoke-weekly-report
```

---

## 3. Fonction 2 — Resize d'images (S3 + Sharp)

### Architecture

```
Admin (formulaire Angular)
        │  Upload image originale
        ▼
  S3 Bucket: portfolio-dev-project-images
    └── originals/<nom-fichier>.<ext>    ← PUT déclenche la notification
        │
        └── S3 Event Notification → InvokeFunction
                │
                ▼
        Lambda: portfolio-dev-image-resize
        Runtime: Node.js 20.x ESM
        Memory: 512 MB | Timeout: 60s
        Library: sharp 0.33 (libvips, binaires Linux x86_64)
                │
                ├── card  (640×360)  → resized/<nom>-card.webp
                ├── thumb (320×180)  → resized/<nom>-thumb.webp
                └── og    (1200×630) → resized/<nom>-og.webp
                        │
                        ▼ (Public GET autorisé)
                Frontend Angular : <img src="https://s3.../resized/...">
```

### Variantes générées

| Variant | Dimensions | Usage |
|---|---|---|
| `card` | 640×360 | Cartes projets (portfolio listing) |
| `thumb` | 320×180 | Thumbnail miniature |
| `og` | 1200×630 | Open Graph (partage réseaux sociaux) |

Toutes les variantes sont converties en **WebP** (format moderne, ~30% plus léger que JPEG à qualité équivalente) avec `quality: 82` et `fit: cover`.

### Sécurité S3

| Préfixe | Accès | Explication |
|---|---|---|
| `originals/` | Privé | Seule la Lambda peut lire (IAM) |
| `resized/` | Public GET | Le frontend charge les images directement depuis S3 |

La politique S3 n'autorise que `s3:GetObject` sur `resized/*`. Les originaux ne sont jamais exposés publiquement.

### Build sur Windows / macOS

`sharp` compile des binaires natifs pour Linux. Le build utilise le flag npm `--platform=linux` pour télécharger les bons binaires avant de zipper la Lambda :

```bash
cd lambdas/image-resize && npm ci --omit=dev --platform=linux --arch=x64 --libc=glibc
```

### IAM (moindre privilège)

```json
[
  { "Effect": "Allow", "Action": ["s3:GetObject"],  "Resource": "arn:aws:s3:::*-project-images/originals/*" },
  { "Effect": "Allow", "Action": ["s3:PutObject"],  "Resource": "arn:aws:s3:::*-project-images/resized/*"  }
]
```

La Lambda ne peut lire que les originaux et n'écrire que dans le dossier `resized/`.

---

## 4. Fonction 3 — Formulaire de contact

### Architecture

```
Browser (Angular — page /contact)
        │  POST /contact
        │  { "name": "...", "email": "...", "message": "..." }
        ▼
  API Gateway HTTP API
  Endpoint: https://<id>.execute-api.eu-west-3.amazonaws.com/contact
  CORS: configuré au niveau API Gateway (pas dans le code Lambda)
        │
        └── AWS_PROXY integration → InvokeFunction
                │
                ▼
        Lambda: portfolio-dev-contact-form
        Runtime: Node.js 20.x ESM
        Memory: 128 MB | Timeout: 15s
                │
                ├── Validation des champs (nom, email, message)
                │   → 422 si invalide
                │
                └── SESClient.SendEmailCommand
                      From:      noreply@domaine.com
                      To:        admin@gmail.com
                      Reply-To:  <email du visiteur>     ← Répondre directement
                      Subject:   "[Portfolio] Message de Prénom Nom"
                      Body:      HTML + text/plain
                        │
                        ▼
                  200 { "success": true }
```

### Validation côté Lambda

La validation est faite dans le code Lambda (pas uniquement côté Angular) — principe de **defense in depth** :

```
name    : requis, min 2 caractères
email   : format RFC 5322 (regex)
message : requis, 10–2000 caractères
```

Les erreurs retournent HTTP 422 avec le tableau `errors[]` — permettant à Angular d'afficher des messages précis.

### Gestion CORS

Le CORS est configuré directement sur l'API Gateway HTTP :

```hcl
cors_configuration {
  allow_origins = ["https://portfolio.mondomaine.com"]
  allow_methods = ["POST", "OPTIONS"]
  allow_headers = ["Content-Type"]
  max_age       = 3600
}
```

API Gateway répond aux requêtes `OPTIONS` preflight sans déclencher la Lambda — optimisation coût et latence.

### Sécurité

- `Reply-To:` positionné sur l'email du visiteur → l'admin peut répondre directement sans exposer son adresse
- Tous les champs HTML sont échappés avant insertion dans l'email (protection XSS)
- Aucun accès DB, aucun secret stocké dans le code — uniquement des variables d'environnement injectées par Terraform

### Intégration Angular

Après `terraform apply`, l'URL de l'API Gateway est disponible via :

```bash
terraform output contact_api_endpoint
# → https://<id>.execute-api.eu-west-3.amazonaws.com/contact
```

À injecter dans `frontend/src/environments/environment.prod.ts` :

```typescript
export const environment = {
  production: true,
  apiUrl: 'http://<EC2_IP>',
  contactApiUrl: 'https://<id>.execute-api.eu-west-3.amazonaws.com/contact',
};
```

---

## 5. Infrastructure Terraform

### Modules créés

| Module | Ressources AWS |
|---|---|
| `lambda-weekly-report` | IAM Role + Policy, Lambda, CloudWatch Log Group, EventBridge Scheduler, IAM Scheduler Role |
| `lambda-image-resize` | IAM Role + Policy, Lambda, S3 Bucket + Versioning + Encryption + CORS + Policy, CloudWatch Log Group, Lambda Permission |
| `lambda-contact-form` | IAM Role + Policy, Lambda, API Gateway HTTP API + Stage + Integration + Route, Lambda Permission, CloudWatch Log Group (Lambda + API GW) |

### Déploiement

```bash
# 1. Vérifier les emails SES (une seule fois par compte AWS)
make ses-verify SENDER_EMAIL=noreply@domaine.com RECIPIENT_EMAIL=admin@gmail.com

# 2. Builder les fonctions Lambda (installe node_modules)
make lambda-build

# 3. Configurer terraform.tfvars
cat >> terraform/terraform.tfvars << EOF
lambda_sender_email            = "noreply@domaine.com"
lambda_recipient_email         = "admin@gmail.com"
lambda_contact_allowed_origins = "https://portfolio.mondomaine.com"
EOF

# 4. Planifier et appliquer
make tf-plan && make tf-apply

# 5. Tester
make lambda-invoke-weekly-report   # Rapport immédiat
make lambda-test-contact           # Formulaire de contact
```

### Outputs après apply

```bash
terraform output lambda_weekly_report_function_name
# → portfolio-dev-weekly-report

terraform output contact_api_endpoint
# → https://abc123.execute-api.eu-west-3.amazonaws.com/contact

terraform output images_bucket_name
# → portfolio-dev-project-images

terraform output images_resized_base_url
# → https://portfolio-dev-project-images.s3.eu-west-3.amazonaws.com/resized
```

---

## 6. Coût détaillé — Free Tier

| Service | Volume réel | Free Tier | Coût |
|---|---|---|---|
| Lambda requests | ~100/mois (3 fonctions) | 1 000 000/mois | **$0** |
| Lambda compute | ~50 GB-s/mois | 400 000 GB-s/mois | **$0** |
| EventBridge Scheduler | 4 exécutions/mois | 14 000 000/mois | **$0** |
| SES emails | ~60/mois | 62 000/mois depuis Lambda | **$0** |
| API Gateway HTTP | ~50 appels/mois | 1 000 000/mois (12 mois) | **$0** |
| S3 stockage | ~25 MB | 5 GB (12 mois) | **$0** |
| CloudWatch Logs | rétention 7j | 5 GB/mois | **$0** |
| **Total** | | | **$0/mois** |

Après 12 mois (expiration Free Tier S3 et API Gateway) : **< $0.01/mois** aux volumes d'un portfolio.

---

## 7. Points clés pour un entretien

**Pourquoi Node.js et pas Java pour les Lambdas ?**
Spring Boot Lambda a un cold start de 8–15s même avec SnapStart. Node.js 20 démarre en 100–300ms. Pour des fonctions ponctuelles déclenchées par événement, le cold start est critique.

**Pourquoi EventBridge Scheduler et pas une simple CloudWatch Event Rule ?**
EventBridge Scheduler (2022) remplace les CloudWatch Events Rules pour les schedules : meilleure précision, support timezone, flexible time windows, et retry policy intégrée.

**Comment éviter les cold starts ?**
Pour les fonctions peu fréquentes (weekly-report, ~4/mois), les cold starts sont acceptables. Pour contact-form (interactive), 128 MB garantit un cold start < 500ms — acceptable pour un formulaire de contact.

**IAM least privilege — comment tu l'as appliqué ?**
Chaque Lambda a son propre rôle IAM avec uniquement les permissions nécessaires :
- `weekly-report` : `ses:SendEmail` uniquement
- `image-resize` : `s3:GetObject` (originals/) + `s3:PutObject` (resized/)
- `contact-form` : `ses:SendEmail` uniquement

Aucune Lambda n'a `AdministratorAccess` ni même `AmazonS3FullAccess`.

**Comment tu gères les secrets dans Lambda ?**
Les données sensibles (emails) sont injectées comme variables d'environnement via Terraform — jamais dans le code source. En production, elles pourraient être stockées dans AWS Secrets Manager et récupérées au démarrage de la Lambda.
