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
      version = "~> 6.52"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # ==========================================================================
  # BACKEND DISTANT — S3 + DynamoDB pour le state partagé
  # ==========================================================================
  # IMPORTANT : Décommenter APRÈS avoir bootstrappé les ressources S3/DynamoDB.
  # Bootstrap avec les scripts dans scripts/bootstrap-state.sh
  #
  # Avantages du backend distant :
  #   - State partagé entre développeurs et CI/CD
  #   - Locking via DynamoDB (évite les conflits)
  #   - Chiffrement at-rest (SSE-S3)
  #   - Versioning activé sur le bucket (rollback possible)
  #
  # backend "s3" {
  #   bucket         = "portfolio-terraform-state"   # À remplacer par ton bucket
  #   key            = "portfolio/prod/terraform.tfstate"
  #   region         = "eu-west-3"
  #   encrypt        = true
  #   dynamodb_table = "portfolio-terraform-locks"   # Pour le locking
  # }
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
