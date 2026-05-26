# =============================================================================
# MODULE ECR — Elastic Container Registry
# =============================================================================
# Crée les dépôts Docker privés pour stocker les images du projet.
#
# Repositories créés :
#   - portfolio-backend  : image Spring Boot Java 21
#   - portfolio-frontend : image Angular + NGINX
#
# Features activées :
#   - Scan on push  : détection CVE à chaque docker push
#   - Lifecycle policy : supprime les vieilles images → économie de stockage
#   - Tag immutability : MUTABLE (permet de ré-écrire 'latest')
#   - Encryption : AES-256 par défaut (activé automatiquement par AWS)
#
# Coût ECR :
#   - 500 MB/mois gratuits (Free Tier permanent)
#   - Au-delà : $0.10/GB/mois
#   - 2 images ~200 MB chacune = ~400 MB/mois → dans le Free Tier
# =============================================================================

resource "aws_ecr_repository" "repos" {
  for_each = toset(var.repositories)

  name                 = each.value
  image_tag_mutability = "MUTABLE" # Permet de retagger 'latest' à chaque build

  # Scan de sécurité automatique à chaque push
  # Résultats visibles dans ECR → Repository → Image scanning
  image_scanning_configuration {
    scan_on_push = var.scan_on_push
  }

  # Chiffrement AES-256 géré par AWS
  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = {
    Name = each.value
  }
}

# =============================================================================
# LIFECYCLE POLICIES — Nettoyage automatique des vieilles images
# =============================================================================
# Raison : sans lifecycle policy, les images s'accumulent indéfiniment.
# 5 images taguées = les 5 derniers builds (rollback possible sur 5 versions).
# Les images non-taguées (dangling) sont supprimées après 1 jour.
resource "aws_ecr_lifecycle_policy" "repos" {
  for_each   = aws_ecr_repository.repos
  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        # Règle 1 : garder les N dernières images taguées
        rulePriority = 1
        description  = "Keep last ${var.image_count_to_keep} tagged images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v", "sha-", "latest"]
          countType     = "imageCountMoreThan"
          countNumber   = var.image_count_to_keep
        }
        action = { type = "expire" }
      },
      {
        # Règle 2 : supprimer les images non-taguées après 1 jour
        # Ces images "dangling" apparaissent quand on re-push un tag existant
        rulePriority = 2
        description  = "Remove untagged images after 1 day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = { type = "expire" }
      }
    ]
  })
}

# =============================================================================
# RESOURCE-BASED POLICY — Accès cross-account (optionnel)
# =============================================================================
# Décommenter pour permettre à un autre compte AWS (ex: staging/prod) de
# puller les images depuis ce registre.
#
# resource "aws_ecr_repository_policy" "cross_account" {
#   for_each   = aws_ecr_repository.repos
#   repository = each.value.name
#
#   policy = jsonencode({
#     Version = "2012-10-17"
#     Statement = [{
#       Sid    = "AllowCrossAccountPull"
#       Effect = "Allow"
#       Principal = {
#         AWS = "arn:aws:iam::PROD_ACCOUNT_ID:root"
#       }
#       Action = [
#         "ecr:GetDownloadUrlForLayer",
#         "ecr:BatchGetImage",
#         "ecr:BatchCheckLayerAvailability"
#       ]
#     }]
#   })
# }
