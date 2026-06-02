# =============================================================================
# MODULE : Lambda Contact Form
# =============================================================================
#
# Architecture :
#
#   Browser (Angular)
#       │  POST /contact  { name, email, message }
#       ▼
#   API Gateway HTTP API
#       │  (CORS géré par le module)
#       ▼
#   Lambda (Node.js 20.x)
#       │  Validation → SES
#       ▼
#   SES → email admin (Reply-To: visiteur)
#
# Prérequis SES (mode sandbox) :
#   Les deux adresses (sender + recipient) doivent être vérifiées.
#   En production : demander la sortie du sandbox SES dans la console AWS.
#
# Coût estimé : $0/mois (Free Tier)
# =============================================================================

# -----------------------------------------------------------------------------
# IAM — Rôle d'exécution Lambda
# -----------------------------------------------------------------------------
resource "aws_iam_role" "lambda" {
  name = "${var.name_prefix}-contact-form-role"

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
# Package — Zip
# -----------------------------------------------------------------------------
data "archive_file" "contact_form" {
  type        = "zip"
  source_dir  = "${path.root}/../lambdas/contact-form"
  output_path = "${path.module}/contact-form.zip"

  excludes = ["package-lock.json"]
}

# -----------------------------------------------------------------------------
# Lambda Function
# -----------------------------------------------------------------------------
resource "aws_lambda_function" "contact_form" {
  filename         = data.archive_file.contact_form.output_path
  source_code_hash = data.archive_file.contact_form.output_base64sha256
  function_name    = "${var.name_prefix}-contact-form"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  runtime          = "nodejs22.x"
  timeout          = 15
  memory_size      = 128

  environment {
    variables = {
      SENDER_EMAIL    = var.sender_email
      RECIPIENT_EMAIL = var.recipient_email
      ALLOWED_ORIGINS = var.allowed_origins
    }
  }

  depends_on = [aws_cloudwatch_log_group.contact_form]
}

resource "aws_cloudwatch_log_group" "contact_form" {
  name              = "/aws/lambda/${var.name_prefix}-contact-form"
  retention_in_days = var.log_retention_days
}

# -----------------------------------------------------------------------------
# API Gateway HTTP API
# -----------------------------------------------------------------------------
resource "aws_apigatewayv2_api" "contact" {
  name          = "${var.name_prefix}-contact-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = split(",", var.allowed_origins)
    allow_methods = ["POST", "OPTIONS"]
    allow_headers = ["Content-Type"]
    max_age       = 3600
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.contact.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.apigw.arn
    format          = jsonencode({ requestId = "$context.requestId", ip = "$context.identity.sourceIp", status = "$context.status" })
  }
}

resource "aws_cloudwatch_log_group" "apigw" {
  name              = "/aws/apigateway/${var.name_prefix}-contact-api"
  retention_in_days = var.log_retention_days
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.contact.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.contact_form.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "post_contact" {
  api_id    = aws_apigatewayv2_api.contact.id
  route_key = "POST /contact"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# -----------------------------------------------------------------------------
# Permission — API Gateway autorisé à invoquer Lambda
# -----------------------------------------------------------------------------
resource "aws_lambda_permission" "allow_apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.contact_form.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.contact.execution_arn}/*/*/contact"
}
