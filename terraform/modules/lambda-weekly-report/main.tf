# =============================================================================
# MODULE : Lambda Weekly Report
# =============================================================================
#
# Architecture :
#
#   EventBridge Scheduler (cron lundi 8h UTC)
#           │
#           ▼
#   Lambda (Node.js 20.x)
#     - GET {api_base_url}/api/v1/projects
#     - Formate le rapport HTML
#           │
#           ▼
#   SES → email admin
#
# Prérequis SES (mode sandbox) :
#   aws ses verify-email-identity --email-address <sender_email>
#   aws ses verify-email-identity --email-address <recipient_email>
#   (Les deux adresses doivent être vérifiées en mode sandbox)
#
# Coût estimé : $0/mois (Free Tier — 4 invocations/mois)
# =============================================================================

# -----------------------------------------------------------------------------
# IAM — Rôle d'exécution Lambda
# -----------------------------------------------------------------------------
resource "aws_iam_role" "lambda" {
  name = "${var.name_prefix}-weekly-report-role"

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

resource "aws_iam_role_policy" "lambda_ses" {
  name = "ses-send"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ses:SendEmail", "ses:SendRawEmail"]
      Resource = "*"
    }]
  })
}

# -----------------------------------------------------------------------------
# Package — Zip du code Lambda (node_modules inclus après npm ci)
# -----------------------------------------------------------------------------
data "archive_file" "weekly_report" {
  type        = "zip"
  source_dir  = "${path.root}/../lambdas/weekly-report"
  output_path = "${path.module}/weekly-report.zip"

  excludes = ["package-lock.json"]
}

# -----------------------------------------------------------------------------
# Lambda Function
# -----------------------------------------------------------------------------
resource "aws_lambda_function" "weekly_report" {
  filename         = data.archive_file.weekly_report.output_path
  source_code_hash = data.archive_file.weekly_report.output_base64sha256
  function_name    = "${var.name_prefix}-weekly-report"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  runtime          = "nodejs22.x"
  timeout          = 30
  memory_size      = 128

  environment {
    variables = {
      SENDER_EMAIL    = var.sender_email
      RECIPIENT_EMAIL = var.recipient_email
      API_BASE_URL    = var.api_base_url
    }
  }

  depends_on = [aws_cloudwatch_log_group.weekly_report]
}

# -----------------------------------------------------------------------------
# CloudWatch Logs — 7 jours de rétention (Free Tier safe)
# -----------------------------------------------------------------------------
resource "aws_cloudwatch_log_group" "weekly_report" {
  name              = "/aws/lambda/${var.name_prefix}-weekly-report"
  retention_in_days = var.log_retention_days
}

# -----------------------------------------------------------------------------
# IAM — Rôle EventBridge Scheduler pour invoquer Lambda
# -----------------------------------------------------------------------------
resource "aws_iam_role" "scheduler" {
  name = "${var.name_prefix}-weekly-report-scheduler-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "scheduler_invoke" {
  name = "invoke-lambda"
  role = aws_iam_role.scheduler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "lambda:InvokeFunction"
      Resource = aws_lambda_function.weekly_report.arn
    }]
  })
}

# -----------------------------------------------------------------------------
# EventBridge Scheduler — Déclenchement hebdomadaire
# -----------------------------------------------------------------------------
resource "aws_scheduler_schedule" "weekly_report" {
  name                         = "${var.name_prefix}-weekly-report"
  schedule_expression          = var.schedule_expression
  schedule_expression_timezone = "UTC"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.weekly_report.arn
    role_arn = aws_iam_role.scheduler.arn
  }
}
