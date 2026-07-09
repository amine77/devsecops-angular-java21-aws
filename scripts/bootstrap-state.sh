#!/usr/bin/env bash
# =============================================================================
# BOOTSTRAP-STATE.SH — Création du bucket S3 pour le state Terraform
# =============================================================================
# Crée le bucket S3 qui héberge le state Terraform partagé (dev + CI/CD).
# Idempotent : peut être relancé sans danger si le bucket existe déjà.
#
# Locking : géré nativement par S3 via `use_lockfile = true` (Terraform >= 1.10).
# Plus besoin de table DynamoDB (approche dépréciée).
#
# Usage : ./scripts/bootstrap-state.sh
# =============================================================================
set -euo pipefail

REGION="eu-west-3"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
# Suffixe account-id : les noms de buckets S3 sont uniques MONDIALEMENT
BUCKET="portfolio-terraform-state-${ACCOUNT_ID}"

echo "Bucket cible : s3://${BUCKET} (${REGION})"

# 1. Création du bucket (idempotent : skip si déjà présent)
if aws s3api head-bucket --bucket "${BUCKET}" 2>/dev/null; then
  echo "Le bucket existe déjà — rien à créer."
else
  aws s3api create-bucket \
    --bucket "${BUCKET}" \
    --region "${REGION}" \
    --create-bucket-configuration LocationConstraint="${REGION}"
  echo "Bucket créé."
fi

# 2. Versioning : permet de restaurer une version antérieure du state
aws s3api put-bucket-versioning \
  --bucket "${BUCKET}" \
  --versioning-configuration Status=Enabled

# 3. Chiffrement at-rest par défaut (SSE-S3)
aws s3api put-bucket-encryption \
  --bucket "${BUCKET}" \
  --server-side-encryption-configuration '{
    "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]
  }'

# 4. Blocage TOTAL de l'accès public (le state contient des secrets)
aws s3api put-public-access-block \
  --bucket "${BUCKET}" \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

echo "Bootstrap terminé. Backend à configurer dans terraform/versions.tf :"
echo "  bucket       = \"${BUCKET}\""
echo "  key          = \"portfolio/prod/terraform.tfstate\""
echo "  region       = \"${REGION}\""
echo "  encrypt      = true"
echo "  use_lockfile = true"
