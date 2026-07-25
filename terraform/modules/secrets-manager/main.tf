# =============================================================================
# MODULE SECRETS MANAGER — Stockage sécurisé des secrets de l'application
# =============================================================================
#
# Phase 21 — External Secrets Operator
#
# Principe :
#   Les secrets applicatifs (DB, JWT, Redis) sont stockés dans AWS Secrets
#   Manager (chiffrés AES-256, auditables via CloudTrail).
#   External Secrets Operator (ESO) les synchronise automatiquement dans
#   des Kubernetes Secrets. Résultat : AUCUN secret en clair dans Git ou
#   dans terraform.tfvars en production.
#
# Structure :
#   /portfolio/dev  → JSON { db-url, db-username, db-password, jwt-secret, redis-host }
#   /portfolio/prod → JSON { ... } (valeurs de production)
#
# Avantages vs kubectl create secret :
#   ✅ Rotation automatique possible (sans redéploiement)
#   ✅ Audit trail complet (CloudTrail)
#   ✅ Chiffrement KMS at-rest
#   ✅ Accès IAM granulaire (qui peut lire quoi)
#   ✅ Versionning (12 versions max conservées)
#   ✅ Zéro secret dans Git
#
# Coût : $0.40/secret/mois — 2 secrets = $0.80/mois
# =============================================================================

# =============================================================================
# SECRET — Environnement dev
# =============================================================================
resource "aws_secretsmanager_secret" "dev" {
  name        = "portfolio/dev"
  description = "Secrets applicatifs portfolio — environnement dev (K3s)"

  # Récupération immédiate en cas de terraform destroy (pas d'attente 7 jours)
  # En production : retirer cette ligne (protection contre suppression accidentelle)
  recovery_window_in_days = 0

  tags = {
    Name        = "${var.name_prefix}-secrets-dev"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}

resource "aws_secretsmanager_secret_version" "dev" {
  secret_id = aws_secretsmanager_secret.dev.id

  # Stockage JSON — ESO extrait chaque clé individuellement via `property`
  # IMPORTANT : ne jamais committer les vraies valeurs — toujours via tfvars
  secret_string = jsonencode({
    "db-url"      = "jdbc:postgresql://${var.rds_host}:${var.rds_port}/${var.db_name}"
    "db-username" = var.db_username
    "db-password" = var.db_password
    "jwt-secret"  = var.jwt_secret
    "redis-host"  = "localhost" # Redis intégré dans le pod K3s (dev)
  })

  # Lifecycle : ne pas mettre à jour si la valeur change en dehors de Terraform
  # (ex: rotation manuelle) — évite les conflits
  lifecycle {
    ignore_changes = [secret_string]
  }
}

# =============================================================================
# SECRET — Environnement prod
# =============================================================================
resource "aws_secretsmanager_secret" "prod" {
  name        = "portfolio/prod"
  description = "Secrets applicatifs portfolio — environnement prod"

  # En prod : recovery_window = 7 jours (protection par défaut)
  recovery_window_in_days = var.environment == "prod" ? 7 : 0

  tags = {
    Name        = "${var.name_prefix}-secrets-prod"
    Environment = "prod"
    ManagedBy   = "terraform"
  }
}

resource "aws_secretsmanager_secret_version" "prod" {
  secret_id = aws_secretsmanager_secret.prod.id

  secret_string = jsonencode({
    "db-url"      = "jdbc:postgresql://${var.rds_host}:${var.rds_port}/${var.db_name}"
    "db-username" = var.db_username
    "db-password" = var.db_password
    "jwt-secret"  = var.jwt_secret
    "redis-host"  = "localhost"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# =============================================================================
# RESOURCE POLICY — Qui peut lire ces secrets
# =============================================================================
# Optionnel : restreindre la lecture aux rôles IAM autorisés.
# Par défaut, l'IAM policy sur le rôle EC2 suffit.
# Décommentez pour une sécurité supplémentaire en production.

# resource "aws_secretsmanager_secret_policy" "dev" {
#   secret_arn = aws_secretsmanager_secret.dev.arn
#   policy = jsonencode({
#     Version = "2012-10-17"
#     Statement = [{
#       Sid    = "AllowEC2RoleAccess"
#       Effect = "Allow"
#       Principal = {
#         AWS = var.ec2_role_arn
#       }
#       Action   = "secretsmanager:GetSecretValue"
#       Resource = "*"
#     }]
#   })
# }
