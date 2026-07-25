# =============================================================================
# MODULE SECURITY GROUPS — Firewalls applicatifs AWS
# =============================================================================
#
# Principe du moindre privilège :
#   - Chaque SG n'autorise que ce dont le service a strictement besoin
#   - Les SGs se référencent entre eux (pas de CIDR en dur sauf pour SSH)
#   - L'egress est ouvert (nécessaire pour les mises à jour système, ECR, etc.)
#
# Architecture des flux :
#
#   Internet → ec2_sg (80, 443, 22)
#   ec2_sg   → rds_sg (5432)
#   rds_sg   → aucun ingress autre que ec2_sg
#
# =============================================================================

# =============================================================================
# SECURITY GROUP EC2 — Serveur applicatif
# =============================================================================
resource "aws_security_group" "ec2" {
  name        = "${var.name_prefix}-ec2-sg"
  description = "Security group for EC2 application server"
  vpc_id      = var.vpc_id

  # --- Ingress ---

  # HTTP public (Angular via NGINX)
  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS (pour future migration SSL/TLS)
  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # SSH — restreindre à ton IP en production !
  # Raison : laisser 0.0.0.0/0 expose au brute-force SSH
  # En prod : utiliser AWS Systems Manager Session Manager (sans port 22)
  ingress {
    description = "SSH for server management (restrict to your IP in production)"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
  }

  # Port 30080 — ArgoCD UI (NodePort K3s)
  # Restreindre à ton IP en production ! Laisser 0.0.0.0/0 expose l'UI publiquement.
  ingress {
    description = "ArgoCD UI NodePort (K3s Phase 20) - restrict to your IP in prod"
    from_port   = 30080
    to_port     = 30080
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr] # Même restriction que SSH
  }

  # Port 8080 Spring Boot — accessible depuis le réseau VPC uniquement
  # (NGINX sur le même hôte proxie vers localhost:8080 → pas besoin de l'exposer)
  # Décommenter si tu veux accéder directement au backend depuis internet (dev only)
  # ingress {
  #   description = "Spring Boot direct access (dev only)"
  #   from_port   = 8080
  #   to_port     = 8080
  #   protocol    = "tcp"
  #   cidr_blocks = ["0.0.0.0/0"]
  # }

  # --- Egress ---
  # Autorise tout le trafic sortant :
  #   - Mises à jour système (dnf update)
  #   - Pull ECR (HTTPS 443)
  #   - Connexion RDS (5432)
  #   - AWS APIs (CloudWatch, Secrets Manager)
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.name_prefix}-ec2-sg"
    Role = "application-server"
  }

  # Forcer la recréation si le nom change (SG ne peut pas être renommé)
  lifecycle {
    create_before_destroy = true
  }
}

# Security group RDS supprimé le 24/07/2026 — PostgreSQL containerisé sur l'EC2,
# le trafic 5432 reste local au réseau docker-compose, plus besoin de SG dédié.
