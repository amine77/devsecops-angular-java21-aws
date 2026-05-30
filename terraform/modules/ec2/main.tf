# =============================================================================
# MODULE EC2 — Serveur applicatif
# =============================================================================
#
# Architecture :
#   EC2 t2.micro (Free Tier) dans un subnet PUBLIC
#   - IAM Instance Profile → accès ECR + CloudWatch Logs
#   - Elastic IP → IP publique fixe (survive aux redémarrages)
#   - User data → bootstrap Docker + pull ECR + docker-compose up
#   - Amazon Linux 2023 (dernière AMI stable)
#
# Pas de NAT Gateway = EC2 en subnet public avec SG restrictif.
# Documenté comme compromis coût/sécurité pour un portfolio Free Tier.
#
# =============================================================================

# =============================================================================
# AMI — Dernière Amazon Linux 2023 (64-bit x86)
# =============================================================================
# Raison : AL2023 inclut dnf, systemd, AWS CLI v2, et est maintenue par AWS.
# Le data source récupère toujours la dernière version stable.
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"] # AMIs officielles Amazon uniquement

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

# =============================================================================
# IAM — Rôle pour l'EC2 Instance Profile
# =============================================================================
# Raison : l'instance profile permet à l'EC2 d'appeler les APIs AWS
# (ECR, CloudWatch) sans stocker de clés d'accès sur le serveur.
# Principe du moindre privilège : on donne uniquement les actions nécessaires.

resource "aws_iam_role" "ec2" {
  name        = "${var.name_prefix}-ec2-role"
  description = "IAM role for EC2 portfolio server — ECR pull + CloudWatch logs"

  # Trust policy : seul EC2 peut assumer ce rôle
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })

  tags = {
    Name = "${var.name_prefix}-ec2-role"
  }
}

# --- Policy : ECR (pull images) ---
resource "aws_iam_role_policy" "ecr_pull" {
  name = "${var.name_prefix}-ecr-pull"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # GetAuthorizationToken : nécessaire pour "aws ecr get-login-password"
        # S'applique à toutes les ressources (pas de restriction ARN possible)
        Sid      = "ECRGetToken"
        Effect   = "Allow"
        Action   = "ecr:GetAuthorizationToken"
        Resource = "*"
      },
      {
        # Pull des images des repositories spécifiques seulement
        Sid    = "ECRPullImages"
        Effect = "Allow"
        Action = [
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchCheckLayerAvailability",
          "ecr:DescribeImages"
        ]
        Resource = var.ecr_repository_arns
      }
    ]
  })
}

# --- Policy : CloudWatch Logs (logs applicatifs) ---
resource "aws_iam_role_policy" "cloudwatch_logs" {
  name = "${var.name_prefix}-cloudwatch-logs"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "CloudWatchLogsWrite"
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams"
      ]
      # Restreint aux groupes de logs du projet uniquement
      Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/portfolio/*"
    }]
  })
}

# --- Instance Profile --- (pont entre le rôle IAM et l'instance EC2)
resource "aws_iam_instance_profile" "ec2" {
  name = "${var.name_prefix}-ec2-profile"
  role = aws_iam_role.ec2.name

  tags = {
    Name = "${var.name_prefix}-ec2-profile"
  }
}

# =============================================================================
# EC2 INSTANCE
# =============================================================================
resource "aws_instance" "main" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = var.instance_type
  subnet_id              = var.public_subnet_id
  vpc_security_group_ids = [var.security_group_id]
  key_name               = var.key_name
  iam_instance_profile   = aws_iam_instance_profile.ec2.name

  # Root volume
  # - Docker Compose (Phase 6) : 20GB suffisent
  # - K3s (Phase 20) : 28GB pour OS + SWAP file 4GB + images containers K3s/ArgoCD
  #   Note : Free Tier = 30GB EBS, donc 28GB laisse 2GB de marge
  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.deployment_mode == "k3s" ? 28 : 20
    encrypted             = true
    delete_on_termination = true
    tags = {
      Name = "${var.name_prefix}-root-volume"
    }
  }

  # User data : script de bootstrap sélectionné selon deployment_mode
  #   "docker" → user-data.sh.tpl    : Docker Compose (Phase 6 — Free Tier)
  #   "k3s"   → user-data-k3s.sh.tpl : K3s + ArgoCD (Phase 20 — Free Tier avec SWAP)
  user_data = var.deployment_mode == "k3s" ? templatefile("${path.module}/user-data-k3s.sh.tpl", {
    aws_region             = var.aws_region
    ecr_backend_url        = var.ecr_backend_url
    ecr_frontend_url       = var.ecr_frontend_url
    rds_host               = var.rds_host
    rds_port               = var.rds_port
    db_name                = var.db_name
    db_username            = var.db_username
    db_password            = var.db_password
    jwt_secret             = var.jwt_secret
    environment            = var.environment
    github_repo            = var.github_repo
    argocd_admin_password  = var.argocd_admin_password
  }) : templatefile("${path.module}/user-data.sh.tpl", {
    aws_region       = var.aws_region
    ecr_backend_url  = var.ecr_backend_url
    ecr_frontend_url = var.ecr_frontend_url
    image_tag        = var.image_tag
    rds_host         = var.rds_host
    rds_port         = var.rds_port
    db_name          = var.db_name
    db_username      = var.db_username
    db_password      = var.db_password
    jwt_secret       = var.jwt_secret
    environment      = var.environment
  })

  # Remplacer l'instance si le user_data change (force un redéploiement)
  # Raison : user_data ne peut pas être modifié sur une instance en cours d'exécution
  user_data_replace_on_change = true

  # Métadonnées IMDSv2 obligatoire (sécurité — empêche SSRF via IMDS)
  # CVE connue : des applications malveillantes peuvent voler le token IMDSv1
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required" # IMDSv2 uniquement
    http_put_response_hop_limit = 1          # Limite à l'instance elle-même
  }

  tags = {
    Name        = "${var.name_prefix}-server"
    Environment = var.environment
    Role        = "application-server"
  }
}

# =============================================================================
# ELASTIC IP — IP publique fixe
# =============================================================================
# Raison : sans EIP, l'IP publique change à chaque redémarrage de l'instance.
# Avec EIP, l'IP est fixe → le DNS peut pointer dessus de façon stable.
# Coût : gratuit si associée à une instance en cours d'exécution.
#         $0.005/h si NON associée (facturation même à l'arrêt) !
resource "aws_eip" "main" {
  instance = aws_instance.main.id
  domain   = "vpc"

  tags = {
    Name = "${var.name_prefix}-eip"
  }

  # L'EIP doit être créée après l'IGW (dépendance implicite)
  depends_on = [aws_instance.main]
}

# =============================================================================
# CLOUDWATCH — Alarmes de monitoring (Free Tier : 10 alarmes)
# =============================================================================

# Alarme CPU — t2.micro peut throttle à >80% CPU
resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  alarm_name          = "${var.name_prefix}-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "300" # 5 minutes
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "CPU > 80% for 10 minutes on ${var.name_prefix}"
  treat_missing_data  = "notBreaching"

  dimensions = {
    InstanceId = aws_instance.main.id
  }

  tags = {
    Name = "${var.name_prefix}-cpu-alarm"
  }
}

# Alarme RAM indirecte via swap (t2.micro = 1GB RAM)
# Note : RAM n'est pas disponible nativement dans CloudWatch EC2
# Il faudrait l'agent CloudWatch pour les métriques mémoire
