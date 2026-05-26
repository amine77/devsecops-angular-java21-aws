# =============================================================================
# MODULE RDS — PostgreSQL géré par AWS
# =============================================================================
#
# Configuration Free Tier :
#   - db.t3.micro : 2 vCPU, 1 GB RAM (750 h/mois gratuit 12 mois)
#   - 20 GB gp2 storage (gratuit)
#   - Single-AZ (Multi-AZ = 2x le coût)
#   - PostgreSQL 15 (LTS)
#
# Sécurité :
#   - Subnet group dans les subnets PRIVÉS (pas accessible depuis internet)
#   - Security group : accès uniquement depuis le SG EC2
#   - Chiffrement at-rest : activé (AES-256)
#   - Chiffrement in-transit : requis via rds.force_ssl = 1
#   - Backup automatique : 7 jours avec point-in-time recovery
#   - Deletion protection : activé en prod, désactivé en dev
#
# =============================================================================

# =============================================================================
# SUBNET GROUP — Détermine dans quels subnets RDS peut être déployé
# =============================================================================
# Raison : RDS nécessite un subnet group avec au moins 2 subnets dans 2 AZs
# différentes, même en Single-AZ. Cela prépare une éventuelle migration Multi-AZ.
resource "aws_db_subnet_group" "main" {
  name        = "${var.name_prefix}-rds-subnet-group"
  description = "Private subnets for RDS PostgreSQL (no internet access)"
  subnet_ids  = var.private_subnet_ids

  tags = {
    Name = "${var.name_prefix}-rds-subnet-group"
  }
}

# =============================================================================
# PARAMETER GROUP — Configuration PostgreSQL
# =============================================================================
# Permet de surcharger les paramètres PostgreSQL sans redémarrage (dynamic).
# family = postgres15 correspond à PostgreSQL 15.x
resource "aws_db_parameter_group" "main" {
  name        = "${var.name_prefix}-pg15"
  family      = "postgres15"
  description = "Custom parameter group for ${var.name_prefix} PostgreSQL 15"

  # Force SSL pour toutes les connexions
  # Raison : chiffre le trafic EC2 → RDS même dans le VPC privé
  parameter {
    name  = "rds.force_ssl"
    value = "1"
    # apply_method = "pending-reboot" pour les paramètres statiques
    # apply_method = "immediate" pour les paramètres dynamiques
    apply_method = "pending-reboot"
  }

  # Log des connexions (audit) — désactivé par défaut (performance)
  # Activer en cas d'audit de sécurité
  # parameter {
  #   name  = "log_connections"
  #   value = "1"
  #   apply_method = "pending-reboot"
  # }

  tags = {
    Name = "${var.name_prefix}-pg15-params"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# =============================================================================
# RDS INSTANCE — PostgreSQL 15
# =============================================================================
resource "aws_db_instance" "main" {
  identifier = "${var.name_prefix}-postgres"

  # --- Engine ---
  engine         = "postgres"
  engine_version = "15"
  instance_class = var.db_instance_class

  # --- Storage (Free Tier : max 20 GB gp2) ---
  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.allocated_storage # Désactive l'autoscaling (coût maîtrisé)
  storage_type          = "gp2"                 # General Purpose SSD
  storage_encrypted     = true                  # Chiffrement at-rest AES-256

  # --- Database ---
  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  # --- Network ---
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [var.security_group_id]
  publicly_accessible    = false # JAMAIS exposé à internet

  # --- Configuration ---
  parameter_group_name = aws_db_parameter_group.main.name
  port                 = 5432

  # --- Haute disponibilité (Single-AZ pour Free Tier) ---
  multi_az = false # true = ~2x le coût mais failover automatique

  # --- Backups ---
  # Backup automatique quotidien (PITR = Point-in-Time Recovery)
  backup_retention_period  = var.backup_retention_days
  backup_window            = "02:00-03:00"         # UTC — créneau de faible charge
  maintenance_window       = "Mon:03:00-Mon:04:00" # Après le backup
  copy_tags_to_snapshot    = true
  delete_automated_backups = true # Supprime les backups auto si l'instance est détruite

  # --- Snapshot final ---
  # skip_final_snapshot = false en production pour garder les données
  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${var.name_prefix}-final-snapshot"

  # --- Sécurité ---
  # Protection contre les suppressions accidentelles en prod
  deletion_protection = var.environment == "prod" ? true : false

  # Mises à jour mineures automatiques (patch security fixes)
  # Raison : les patches mineurs corrigent des CVE sans changer l'API
  auto_minor_version_upgrade = true

  # --- Performance Insights (monitoring gratuit 7 jours) ---
  performance_insights_enabled          = true
  performance_insights_retention_period = 7 # Gratuit jusqu'à 7 jours

  tags = {
    Name        = "${var.name_prefix}-postgres"
    Engine      = "PostgreSQL 15"
    Environment = var.environment
  }
}
