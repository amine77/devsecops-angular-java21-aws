# =============================================================================
# MODULE VPC — Réseau AWS
# =============================================================================
#
# Architecture réseau :
#
#   Internet
#       │
#   Internet Gateway (IGW)
#       │
#   ┌───┴──────────────────────────────────────┐
#   │              VPC 10.0.0.0/16             │
#   │                                          │
#   │  ┌──────────────┐  ┌──────────────┐     │
#   │  │Public 3a     │  │Public 3b     │     │
#   │  │10.0.1.0/24   │  │10.0.2.0/24  │     │  ← EC2 ici
#   │  └──────────────┘  └──────────────┘     │
#   │                                          │
#   │  ┌──────────────┐  ┌──────────────┐     │
#   │  │Private 3a    │  │Private 3b    │     │
#   │  │10.0.10.0/24  │  │10.0.11.0/24 │     │  ← RDS ici
#   │  └──────────────┘  └──────────────┘     │
#   └──────────────────────────────────────────┘
#
# CHOIX ARCHITECTURAL — Pas de NAT Gateway :
#   Un NAT Gateway coûte ~$32/mois (fixe) + $0.045/GB data.
#   Pour ce portfolio Free Tier, l'EC2 est dans un subnet PUBLIC avec
#   un Security Group restrictif (seuls les ports 22/80/443 ouverts).
#   En production enterprise, on mettrait l'EC2 en subnet privé + NAT Gateway.
#   Ce compromis est documenté et acceptable pour un portfolio.
#
# =============================================================================

# =============================================================================
# VPC
# =============================================================================
resource "aws_vpc" "main" {
  cidr_block = var.vpc_cidr

  # DNS requis pour :
  #   - Résolution des noms RDS (xxx.rds.amazonaws.com) depuis EC2
  #   - ECR endpoint resolution
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${var.name_prefix}-vpc"
  }
}

# =============================================================================
# SUBNETS PUBLICS — EC2 et potentiellement ALB
# =============================================================================
resource "aws_subnet" "public" {
  count = length(var.public_subnet_cidrs)

  vpc_id            = aws_vpc.main.id
  cidr_block        = var.public_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  # Les instances dans ce subnet reçoivent une IP publique par défaut.
  # Raison : EC2 doit pouvoir communiquer avec ECR pour puller les images.
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.name_prefix}-public-${var.availability_zones[count.index]}"
    Type = "public"
    # Tags requis pour AWS Load Balancer Controller (EKS) si migration future
    "kubernetes.io/role/elb" = "1"
  }
}

# =============================================================================
# SUBNETS PRIVÉS — RDS (pas d'accès internet direct)
# =============================================================================
resource "aws_subnet" "private" {
  count = length(var.private_subnet_cidrs)

  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  # Pas d'IP publique pour les ressources privées (RDS)
  map_public_ip_on_launch = false

  tags = {
    Name                              = "${var.name_prefix}-private-${var.availability_zones[count.index]}"
    Type                              = "private"
    "kubernetes.io/role/internal-elb" = "1"
  }
}

# =============================================================================
# INTERNET GATEWAY — Connexion VPC ↔ Internet
# =============================================================================
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.name_prefix}-igw"
  }
}

# =============================================================================
# ROUTE TABLE PUBLIQUE — Routage via IGW pour les subnets publics
# =============================================================================
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  # Route par défaut : tout le trafic non-local passe par l'IGW
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.name_prefix}-rt-public"
  }
}

# Association des subnets publics à la route table publique
resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# =============================================================================
# ROUTE TABLE PRIVÉE — Pas de route internet pour RDS
# =============================================================================
# Les subnets privés n'ont pas de route vers Internet.
# RDS n'a pas besoin d'internet : il est accessible depuis EC2 via l'IP privée.
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  # Aucune route vers 0.0.0.0/0 — trafic local VPC uniquement
  tags = {
    Name = "${var.name_prefix}-rt-private"
  }
}

resource "aws_route_table_association" "private" {
  count = length(aws_subnet.private)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# =============================================================================
# VPC FLOW LOGS — Audit du trafic réseau (sécurité)
# =============================================================================
# Raison : les Flow Logs permettent d'analyser le trafic en cas d'incident.
# Ils enregistrent : source IP, dest IP, port, action (ACCEPT/REJECT), bytes.
# Coût : gratuit pour la collecte, facturation CloudWatch Logs (~$0.50/GB).

resource "aws_cloudwatch_log_group" "vpc_flow_logs" {
  name              = "/aws/vpc/${var.name_prefix}/flow-logs"
  retention_in_days = 7 # 7 jours suffit pour un portfolio (30 jours en prod)

  tags = {
    Name = "${var.name_prefix}-vpc-flow-logs"
  }
}

resource "aws_iam_role" "vpc_flow_logs" {
  name = "${var.name_prefix}-vpc-flow-logs-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "vpc-flow-logs.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "vpc_flow_logs" {
  name = "${var.name_prefix}-vpc-flow-logs-policy"
  role = aws_iam_role.vpc_flow_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
      ]
      Resource = "*"
    }]
  })
}

resource "aws_flow_log" "main" {
  vpc_id          = aws_vpc.main.id
  traffic_type    = "ALL" # ACCEPT, REJECT ou ALL
  iam_role_arn    = aws_iam_role.vpc_flow_logs.arn
  log_destination = aws_cloudwatch_log_group.vpc_flow_logs.arn

  tags = {
    Name = "${var.name_prefix}-flow-logs"
  }
}
