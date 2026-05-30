# Security Policy

## Versions supportées

| Version | Supportée          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Signaler une vulnérabilité

Ce dépôt est un **portfolio de démonstration DevSecOps**. Si vous découvrez une vulnérabilité de sécurité, merci de suivre le processus de divulgation responsable ci-dessous.

### Contact

Envoyez un email à : **amine.charrad@gmail.com**

Merci d'inclure dans votre rapport :

- **Description** : nature de la vulnérabilité
- **Impact** : ce qu'un attaquant pourrait accomplir
- **Reproduction** : étapes pour reproduire
- **Preuves** : logs, captures d'écran, PoC (sans exploitation active)
- **Suggestions** : piste de correction si vous en avez une

### Délais de traitement

| Étape | Délai |
|-------|-------|
| Accusé de réception | 48 heures |
| Évaluation initiale | 5 jours ouvrés |
| Correction ou mitigation | 30 jours (critique : 7 jours) |
| Publication du correctif | Après correction |

### Ce qui est hors scope

- Attaques nécessitant un accès physique à la machine
- Attaques de déni de service (DoS/DDoS)
- Vulnérabilités dans les dépendances tierces déjà connues (vérifier d'abord les issues du projet upstream)
- Rapports générés automatiquement sans preuve d'exploitabilité

### Divulgation coordonnée

Une fois la vulnérabilité corrigée, un délai de **90 jours** sera respecté avant toute divulgation publique, sauf accord mutuel.

---

## Outillage de sécurité en place

Ce portfolio intègre une chaîne DevSecOps complète :

| Outil | Couverture |
|-------|------------|
| **GitLeaks** | Détection de secrets dans l'historique Git |
| **CodeQL** | SAST Java 21 + TypeScript (security-extended) |
| **Semgrep** | SAST OWASP Top 10, CWE Top 25, Spring |
| **Trivy** | Vulnérabilités deps + secrets + misconfigs IaC |
| **OWASP Dependency Check** | CVEs Maven + npm |
| **OWASP ZAP** | DAST — scan dynamique authentifié |
| **SonarCloud** | Quality Gate + couverture + hotspots sécurité |
| **CycloneDX SBOM** | Software Bill of Materials (supply chain) |
| **Cosign** | Signature des images Docker (SLSA Level 2) |
| **Dependabot** | Mises à jour automatiques des dépendances |
| **OpenSSF Scorecard** | Bonnes pratiques open-source |

Les résultats sont visibles dans :
- GitHub → **Security** → Code scanning alerts
- GitHub → **Security** → Dependabot alerts
- [SonarCloud Dashboard](https://sonarcloud.io)
