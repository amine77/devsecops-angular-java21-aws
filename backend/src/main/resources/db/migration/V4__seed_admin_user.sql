-- =============================================================================
-- V4__seed_admin_user.sql — Données initiales : utilisateur admin
-- =============================================================================
-- Raison : sans utilisateur en base, le login est impossible.
-- Ce script crée un compte admin pour les tests et la démonstration.
--
-- CREDENTIALS DE DÉMONSTRATION :
--   Email    : admin@portfolio.dev
--   Password : Admin@2024!
--   Hash     : BCrypt strength 12 (généré via bcryptjs)
--
-- ⚠️ SÉCURITÉ : en production, changer ce mot de passe immédiatement via l'API.
--   La variable d'env ADMIN_PASSWORD_HASH peut surcharger ce hash
--   si vous déployez avec un secret manager.
--
-- Pour générer un nouveau hash :
--   node -e "const b = require('bcryptjs'); console.log(b.hashSync('VotreMotDePasse', 12));"
-- =============================================================================

INSERT INTO users (email, password, first_name, last_name, role, enabled, created_at, updated_at)
VALUES (
    'admin@portfolio.dev',
    '$2b$12$vDTclZ2o02pTvaEKXx3xMeGlGB8zaA8hS1/d0edW1JxPbOBX/IIcW',
    'Admin',
    'Portfolio',
    'ADMIN',
    TRUE,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO NOTHING;
-- ON CONFLICT DO NOTHING : idempotent — safe à rejouer si la migration est relancée

-- Utilisateur de démonstration (lecture seule)
INSERT INTO users (email, password, first_name, last_name, role, enabled, created_at, updated_at)
VALUES (
    'demo@portfolio.dev',
    '$2b$12$vDTclZ2o02pTvaEKXx3xMeGlGB8zaA8hS1/d0edW1JxPbOBX/IIcW',
    'Demo',
    'User',
    'USER',
    TRUE,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Quelques projets de démonstration liés à l'admin
INSERT INTO projects (title, description, summary, github_url, demo_url, status, featured, sort_order, user_id, created_at, updated_at)
SELECT
    'Portfolio DevSecOps',
    'Application full-stack démontrant une pipeline DevSecOps complète : Angular 18, Spring Boot Java 21, Docker, Kubernetes (Minikube sur EC2), Helm, Terraform, GitHub Actions CI/CD avec SAST, déploiement AWS Free Tier.',
    'Portfolio cloud-native avec pipeline CI/CD DevSecOps complète',
    'https://github.com/exemple/portfolio-devsecops',
    NULL,
    'ACTIVE',
    TRUE,
    1,
    u.id,
    NOW(),
    NOW()
FROM users u WHERE u.email = 'admin@portfolio.dev'
ON CONFLICT DO NOTHING;

INSERT INTO projects (title, description, summary, github_url, demo_url, status, featured, sort_order, user_id, created_at, updated_at)
SELECT
    'API REST Spring Boot JWT',
    'Backend RESTful avec authentification JWT stateless, Virtual Threads Java 21, Flyway migrations, Testcontainers, JaCoCo 70%+ coverage, SpringDoc OpenAPI 3.',
    'Backend sécurisé Spring Boot 3.3 + Java 21 + PostgreSQL',
    'https://github.com/exemple/spring-boot-jwt',
    NULL,
    'ACTIVE',
    TRUE,
    2,
    u.id,
    NOW(),
    NOW()
FROM users u WHERE u.email = 'admin@portfolio.dev'
ON CONFLICT DO NOTHING;

-- Liaisons projets ↔ compétences
-- Portfolio DevSecOps → toutes les compétences
INSERT INTO project_skills (project_id, skill_id)
SELECT p.id, s.id
FROM projects p, skills s
WHERE p.title = 'Portfolio DevSecOps'
ON CONFLICT DO NOTHING;

-- API REST → compétences backend
INSERT INTO project_skills (project_id, skill_id)
SELECT p.id, s.id
FROM projects p
JOIN skills s ON s.name IN ('Java 21', 'Spring Boot', 'PostgreSQL', 'Docker', 'GitHub Actions')
WHERE p.title = 'API REST Spring Boot JWT'
ON CONFLICT DO NOTHING;
