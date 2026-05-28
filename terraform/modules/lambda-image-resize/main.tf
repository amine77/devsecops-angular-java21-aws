# =============================================================================
# MODULE : Lambda Image Resize
# =============================================================================
#
# Architecture :
#
#   Admin uploads image  →  S3 bucket (originals/<filename>)
#                               │
#                        S3 Event Notification
#                               │
#                               ▼
#                      Lambda (Node.js 20.x + Sharp)
#                               │
#                    ┌──────────┼──────────┐
#                    ▼          ▼          ▼
#           card (640x360) thumb(320x180) og(1200x630)
#           resized/<name>-card.webp  ...thumb.webp  ...og.webp
#
# Convention S3 :
#   originals/  → images uploadées par l'admin
#   resized/    → variantes WebP générées par Lambda
#
# Coût estimé : $0/mois (Free Tier — ~20 uploads/mois)
# =============================================================================

# -----------------------------------------------------------------------------
# S3 Bucket — Stockage images
# -----------------------------------------------------------------------------
resource "aws_s3_bucket" "images" {
  bucket = "${var.name_prefix}-project-images"
}

resource "aws_s3_bucket_versioning" "images" {
  bucket = aws_s3_bucket.images.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "images" {
  bucket = aws_s3_bucket.images.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "images" {
  bucket                  = aws_s3_bucket.images.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "images_read" {
  bucket     = aws_s3_bucket.images.id
  depends_on = [aws_s3_bucket_public_access_block.images]

  # tfsec:ignore:aws-s3-no-public-buckets
  # Public GET on resized/* is intentional: these are portfolio thumbnails
  # served directly by the frontend. originals/* stays private (no policy).
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "PublicReadResized"
      Effect    = "Allow"
      Principal = "*"
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.images.arn}/resized/*"
    }]
  })
}

resource "aws_s3_bucket_cors_configuration" "images" {
  bucket = aws_s3_bucket.images.id
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET"]
    allowed_origins = ["*"]
    max_age_seconds = 3600
  }
}

# -----------------------------------------------------------------------------
# IAM — Rôle d'exécution Lambda
# -----------------------------------------------------------------------------
resource "aws_iam_role" "lambda" {
  name = "${var.name_prefix}-image-resize-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_s3" {
  name = "s3-read-write"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "${aws_s3_bucket.images.arn}/originals/*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject"]
        Resource = "${aws_s3_bucket.images.arn}/resized/*"
      },
    ]
  })
}

# -----------------------------------------------------------------------------
# Package — Zip du code Lambda (sharp inclus après npm ci)
# Note: sharp contient des binaires natifs compilés pour Linux x86_64.
# Utiliser: npm ci --platform=linux --arch=x64 --libc=glibc (sur macOS/Windows)
# -----------------------------------------------------------------------------
data "archive_file" "image_resize" {
  type        = "zip"
  source_dir  = "${path.root}/../lambdas/image-resize"
  output_path = "${path.module}/image-resize.zip"

  excludes = ["package-lock.json"]
}

# -----------------------------------------------------------------------------
# Lambda Function
# -----------------------------------------------------------------------------
resource "aws_lambda_function" "image_resize" {
  filename         = data.archive_file.image_resize.output_path
  source_code_hash = data.archive_file.image_resize.output_base64sha256
  function_name    = "${var.name_prefix}-image-resize"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 60
  memory_size      = 512

  environment {
    variables = {
      DEST_BUCKET = aws_s3_bucket.images.bucket
    }
  }

  depends_on = [aws_cloudwatch_log_group.image_resize]
}

resource "aws_cloudwatch_log_group" "image_resize" {
  name              = "/aws/lambda/${var.name_prefix}-image-resize"
  retention_in_days = var.log_retention_days
}

# -----------------------------------------------------------------------------
# Permission — S3 autorisé à invoquer Lambda
# -----------------------------------------------------------------------------
resource "aws_lambda_permission" "allow_s3" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.image_resize.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.images.arn
}

# -----------------------------------------------------------------------------
# S3 Event Notification → Lambda (déclenché sur PUT dans originals/)
# -----------------------------------------------------------------------------
resource "aws_s3_bucket_notification" "image_upload" {
  bucket     = aws_s3_bucket.images.id
  depends_on = [aws_lambda_permission.allow_s3]

  lambda_function {
    lambda_function_arn = aws_lambda_function.image_resize.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "originals/"
    # Extension filtering is handled in Lambda code (isImage()) to avoid
    # multiple notification rules for each extension.
  }
}
