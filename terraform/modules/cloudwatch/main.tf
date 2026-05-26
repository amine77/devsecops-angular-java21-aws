# =============================================================================
# CLOUDWATCH MODULE — Alarmes + Dashboard + Log Metric Filters
# =============================================================================
#
# Ressources créées :
#   1. Log Group — stockage des logs JSON du backend (30 jours de rétention)
#   2. Log Metric Filters — extraction de métriques depuis les logs JSON
#      - auth_login_failure : détection brute-force
#      - http_5xx_errors    : erreurs applicatives critiques
#   3. CloudWatch Alarms (SNS)
#      - CPU EC2 > 80% (5 min)
#      - Taux d'échec auth > 10/min
#      - Erreurs 5xx > 5/min
#   4. SNS Topic — notifications email
#   5. CloudWatch Dashboard — vue unifiée infrastructure + application
# =============================================================================

# ─── Log Group ───────────────────────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "backend" {
  name              = "/portfolio/backend"
  retention_in_days = 30  # 30 jours = compromis coût/utilité (Free Tier = 5 GB/mois)

  tags = merge(var.tags, {
    Name = "${var.project_name}-backend-logs"
  })
}

# ─── Log Metric Filter : Échecs d'authentification ───────────────────────────
# Extrait les événements de login échoué depuis les logs JSON structurés.
# Pattern : cherche les messages du GlobalExceptionHandler pour BadCredentials.
resource "aws_cloudwatch_log_metric_filter" "auth_failures" {
  name           = "${var.project_name}-auth-failures"
  log_group_name = aws_cloudwatch_log_group.backend.name

  # Pattern JSON CloudWatch Logs — correspondance sur le champ "message"
  # Raison : les logs JSON ont la structure { "message": "Unauthorized access attempt..." }
  pattern = "{ $.message = \"Unauthorized access attempt*\" }"

  metric_transformation {
    name          = "AuthLoginFailures"
    namespace     = "Portfolio/Security"
    value         = "1"
    default_value = "0"
    unit          = "Count"
  }
}

# ─── Log Metric Filter : Erreurs 5xx ─────────────────────────────────────────
resource "aws_cloudwatch_log_metric_filter" "http_5xx" {
  name           = "${var.project_name}-http-5xx"
  log_group_name = aws_cloudwatch_log_group.backend.name

  # Les logs d'erreurs Spring Boot contiennent le niveau ERROR
  pattern = "{ $.level = \"ERROR\" }"

  metric_transformation {
    name          = "Http5xxErrors"
    namespace     = "Portfolio/Application"
    value         = "1"
    default_value = "0"
    unit          = "Count"
  }
}

# ─── SNS Topic — Notifications d'alerte ──────────────────────────────────────
resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-alerts"
  tags = merge(var.tags, { Name = "${var.project_name}-alerts" })
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# ─── Alarme : CPU EC2 élevé ──────────────────────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  alarm_name          = "${var.project_name}-cpu-high"
  alarm_description   = "CPU EC2 > 80% pendant 5 minutes — risque de saturation"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2       # 2 périodes consécutives pour éviter les faux positifs
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300     # 5 minutes
  statistic           = "Average"
  threshold           = 80
  treat_missing_data  = "notBreaching"

  dimensions = {
    InstanceId = var.ec2_instance_id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = merge(var.tags, { Name = "${var.project_name}-cpu-high" })
}

# ─── Alarme : Échecs d'auth (brute-force) ────────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "auth_failures" {
  alarm_name          = "${var.project_name}-auth-brute-force"
  alarm_description   = "Plus de 10 tentatives d'auth échouées en 1 minute — possible brute-force"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "AuthLoginFailures"
  namespace           = "Portfolio/Security"
  period              = 60
  statistic           = "Sum"
  threshold           = 10
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = merge(var.tags, { Name = "${var.project_name}-auth-brute-force" })
}

# ─── Alarme : Erreurs 5xx applicatives ───────────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "http_5xx" {
  alarm_name          = "${var.project_name}-http-5xx-high"
  alarm_description   = "Plus de 5 erreurs HTTP 5xx en 1 minute — régression applicative"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Http5xxErrors"
  namespace           = "Portfolio/Application"
  period              = 60
  statistic           = "Sum"
  threshold           = 5
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = merge(var.tags, { Name = "${var.project_name}-http-5xx-high" })
}

# ─── CloudWatch Dashboard ─────────────────────────────────────────────────────
resource "aws_cloudwatch_dashboard" "portfolio" {
  dashboard_name = "${var.project_name}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      # ── EC2 CPU ──
      {
        type       = "metric"
        x          = 0; y = 0; width = 8; height = 6
        properties = {
          title  = "EC2 — CPU Utilization (%)"
          view   = "timeSeries"
          period = 60
          stat   = "Average"
          metrics = [
            ["AWS/EC2", "CPUUtilization", "InstanceId", var.ec2_instance_id]
          ]
          annotations = {
            horizontal = [{ label = "Seuil alarme", value = 80, color = "#ff6b6b" }]
          }
        }
      },
      # ── Mémoire EC2 (via CloudWatch Agent) ──
      {
        type       = "metric"
        x          = 8; y = 0; width = 8; height = 6
        properties = {
          title  = "EC2 — Mémoire utilisée (%)"
          view   = "timeSeries"
          period = 60
          stat   = "Average"
          metrics = [
            ["CWAgent", "mem_used_percent", "host", "portfolio-ec2"]
          ]
        }
      },
      # ── Auth failures ──
      {
        type       = "metric"
        x          = 16; y = 0; width = 8; height = 6
        properties = {
          title  = "Auth — Échecs / minute"
          view   = "timeSeries"
          period = 60
          stat   = "Sum"
          metrics = [
            ["Portfolio/Security", "AuthLoginFailures"]
          ]
          annotations = {
            horizontal = [{ label = "Alerte brute-force", value = 10, color = "#ff6b6b" }]
          }
        }
      },
      # ── HTTP 5xx ──
      {
        type       = "metric"
        x          = 0; y = 6; width = 12; height = 6
        properties = {
          title  = "HTTP — Erreurs 5xx / minute"
          view   = "timeSeries"
          period = 60
          stat   = "Sum"
          metrics = [
            ["Portfolio/Application", "Http5xxErrors"]
          ]
          annotations = {
            horizontal = [{ label = "Seuil critique", value = 5, color = "#ff6b6b" }]
          }
        }
      },
      # ── Logs récents ──
      {
        type       = "log"
        x          = 12; y = 6; width = 12; height = 6
        properties = {
          title   = "Logs ERROR récents"
          query   = "SOURCE '/portfolio/backend' | fields @timestamp, message, requestId | filter level = 'ERROR' | sort @timestamp desc | limit 20"
          region  = var.aws_region
          view    = "table"
        }
      }
    ]
  })
}
