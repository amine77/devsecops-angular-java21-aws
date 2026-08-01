# =============================================================================
# VERSIONS.TF — Contraintes de versions Terraform et providers
# =============================================================================
# Raison : fixer les versions évite les breaking changes lors des mises à jour.
# "~> 5.50" accepte 5.50.x, 5.51.x, ... mais pas 6.x.
# =============================================================================

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.56"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # ==========================================================================
  # BACKEND DISTANT — S3 pour le state partagé
  # ==========================================================================
  # Bucket bootstrappé via scripts/bootstrap-state.sh (versioning + SSE-S3 +
  # public access block).
  #
  # Avantages du backend distant :
  #   - State partagé entre développeurs et CI/CD
  #   - Locking natif S3 via use_lockfile (Terraform >= 1.10 — remplace
  #     l'ancienne approche DynamoDB, dépréciée)
  #   - Chiffrement at-rest (SSE-S3)
  #   - Versioning activé sur le bucket (rollback possible)
  backend "s3" {
    bucket       = "portfolio-terraform-state-583931058666"
    key          = "portfolio/prod/terraform.tfstate"
    region       = "eu-west-3"
    encrypt      = true
    use_lockfile = true
  }
}

# =============================================================================
# PROVIDER AWS
# =============================================================================
provider "aws" {
  region = var.aws_region

  # Tags appliqués automatiquement à TOUTES les ressources
  # Raison : visibilité dans la console AWS + gestion des coûts par tag
  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
      Repository  = "github.com/charrad/devsecops-portfolio"
    }
  }
}
