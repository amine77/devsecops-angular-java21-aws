-- =============================================================================
-- V23__create_experiences.sql — Section "Expérience" du portfolio.
-- =============================================================================
-- Crée le modèle de données Experience (missions professionnelles) et insère
-- les 3 missions du parcours : Allianz France, Société Générale Securities
-- Services, Boursorama.
--
-- Données Allianz France fournies telles quelles par l'utilisateur.
-- Données SGSS et Boursorama extraites du CV (frontend/src/assets/
-- cv-amine-charrad.pdf) : poste, contexte, dates, réalisations et stack
-- reprennent le texte du CV, sans ajout d'information absente du document.
-- =============================================================================

CREATE TABLE experiences (
    id               BIGSERIAL     PRIMARY KEY,
    entreprise       VARCHAR(200)  NOT NULL,
    poste            VARCHAR(200)  NOT NULL,
    contexte         VARCHAR(500),
    date_debut       DATE          NOT NULL,
    date_fin         DATE,
    description      TEXT          NOT NULL,
    ordre_affichage  INTEGER       NOT NULL DEFAULT 0,
    user_id          BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at       TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_experiences_entreprise_poste UNIQUE (entreprise, poste)
);

CREATE TABLE experience_realisations (
    experience_id BIGINT       NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
    position      INTEGER      NOT NULL,
    realisation   TEXT         NOT NULL
);

CREATE TABLE experience_stack (
    experience_id BIGINT       NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
    position      INTEGER      NOT NULL,
    techno        VARCHAR(100) NOT NULL
);

CREATE INDEX idx_experiences_ordre_affichage      ON experiences(ordre_affichage);
CREATE INDEX idx_experience_realisations_exp_id   ON experience_realisations(experience_id);
CREATE INDEX idx_experience_stack_exp_id          ON experience_stack(experience_id);

-- =============================================================================
-- ALLIANZ FRANCE — Juin 2020 — Aujourd'hui (mission en cours, date_fin NULL)
-- =============================================================================

INSERT INTO experiences (entreprise, poste, contexte, date_debut, date_fin, description, ordre_affichage, user_id, created_at, updated_at)
SELECT
    'Allianz France',
    'Tech Lead / Ingénieur Senior Java Angular & DevSecOps',
    'Groupe d''assurance international — Projets stratégiques Vie & Emprunteur',
    DATE '2020-06-01',
    NULL,
    'Lead hands-on (80% code, 20% pilotage) d''une équipe Agile Scrum de 4 développeurs dont 2 juniors en mentoring. Cadrage des besoins avec les PO, définition de l''architecture cible avec les architectes groupe.',
    1,
    u.id,
    NOW(),
    NOW()
FROM users u WHERE u.email = 'admin@portfolio.dev'
ON CONFLICT (entreprise, poste) DO NOTHING;

INSERT INTO experience_realisations (experience_id, position, realisation)
SELECT e.id, v.position, v.realisation
FROM experiences e
CROSS JOIN (VALUES
    (0, 'Conformité : réécriture d''un monolithe critique en 5 microservices REST sur 18 mois (OpenAPI/Swagger, Angular 20, AWS EKS/ECR)'),
    (1, 'Authentification OIDC via Azure AD, streaming d''événements Kafka, données Amazon RDS'),
    (2, 'Pipeline GitHub Actions DevSecOps : SAST/DAST (CodeQL, OWASP ZAP), Trivy, Cosign, SBOM CycloneDX — couverture SonarQube > 80%'),
    (3, 'Infrastructure AWS via Terraform, déploiement GitOps ArgoCD/Helm'),
    (4, 'OAE — Assurance Emprunteur : application de vente sur iPad pour ~100 commerciaux, 12 écrans, ~250 devis par mois'),
    (5, 'Tests TDD/BDD : JUnit/Mockito, Cucumber/Testcontainers, Cypress, tests de charge Gatling (p95/p99)')
) AS v(position, realisation)
WHERE e.entreprise = 'Allianz France' AND e.poste = 'Tech Lead / Ingénieur Senior Java Angular & DevSecOps'
AND NOT EXISTS (SELECT 1 FROM experience_realisations er WHERE er.experience_id = e.id);

INSERT INTO experience_stack (experience_id, position, techno)
SELECT e.id, v.position, v.techno
FROM experiences e
CROSS JOIN (VALUES
    (0, 'Java 21'),
    (1, 'Spring Boot'),
    (2, 'Angular 20'),
    (3, 'Kafka'),
    (4, 'Kubernetes'),
    (5, 'Terraform'),
    (6, 'AWS EKS/RDS'),
    (7, 'GitHub Actions'),
    (8, 'ArgoCD'),
    (9, 'Dynatrace')
) AS v(position, techno)
WHERE e.entreprise = 'Allianz France' AND e.poste = 'Tech Lead / Ingénieur Senior Java Angular & DevSecOps'
AND NOT EXISTS (SELECT 1 FROM experience_stack es WHERE es.experience_id = e.id);

-- =============================================================================
-- SOCIÉTÉ GÉNÉRALE SECURITIES SERVICES — Avril 2019 — Mai 2020
-- Source : CV, section "SGSS — Securities Services", projet "RST — Référentiel
-- SGSS Tiers". Le CV ne donne pas de phrase de résumé dédiée à cette mission :
-- la description ci-dessous synthétise le nom du projet et ses deux
-- réalisations, sans ajouter d'information absente du document.
-- =============================================================================

INSERT INTO experiences (entreprise, poste, contexte, date_debut, date_fin, description, ordre_affichage, user_id, created_at, updated_at)
SELECT
    'Société Générale Securities Services',
    'Développeur Fullstack Java/JEE Angular',
    'Branche conservation des titres financiers — Société Générale',
    DATE '2019-04-01',
    DATE '2020-05-01',
    'RST — Référentiel SGSS Tiers : développement du portail d''agrégation des flux référentiels de la branche conservation de titres financiers et supervision des traitements en RUN.',
    2,
    u.id,
    NOW(),
    NOW()
FROM users u WHERE u.email = 'admin@portfolio.dev'
ON CONFLICT (entreprise, poste) DO NOTHING;

INSERT INTO experience_realisations (experience_id, position, realisation)
SELECT e.id, v.position, v.realisation
FROM experiences e
CROSS JOIN (VALUES
    (0, 'RST — Référentiel SGSS Tiers : agrégation des flux référentiels (clients, comptes, OPCVM) exposée via portail Java 8/Spring Boot/AngularJS et exports CSV'),
    (1, 'RUN : Sanity Checks, chargement SUMMIT/CRM, supervision des batchs Control-M')
) AS v(position, realisation)
WHERE e.entreprise = 'Société Générale Securities Services' AND e.poste = 'Développeur Fullstack Java/JEE Angular'
AND NOT EXISTS (SELECT 1 FROM experience_realisations er WHERE er.experience_id = e.id);

INSERT INTO experience_stack (experience_id, position, techno)
SELECT e.id, v.position, v.techno
FROM experiences e
CROSS JOIN (VALUES
    (0, 'Java 8'),
    (1, 'Spring Boot'),
    (2, 'AngularJS'),
    (3, 'MySQL'),
    (4, 'MongoDB'),
    (5, 'Redis'),
    (6, 'RabbitMQ')
) AS v(position, techno)
WHERE e.entreprise = 'Société Générale Securities Services' AND e.poste = 'Développeur Fullstack Java/JEE Angular'
AND NOT EXISTS (SELECT 1 FROM experience_stack es WHERE es.experience_id = e.id);

-- =============================================================================
-- BOURSORAMA — Février 2017 — Mars 2019
-- Source : CV, section "Boursorama". Le CV ne donne pas de phrase de résumé
-- dédiée : la description synthétise les deux réalisations listées.
-- =============================================================================

INSERT INTO experiences (entreprise, poste, contexte, date_debut, date_fin, description, ordre_affichage, user_id, created_at, updated_at)
SELECT
    'Boursorama',
    'Développeur Fullstack PHP / Java',
    'Banque en ligne — Leader français du courtage',
    DATE '2017-02-01',
    DATE '2019-03-01',
    'Développement de parcours de souscription (crédit immobilier, assurance-vie, auto) et d''outils de back-office pour la banque en ligne Boursorama.',
    3,
    u.id,
    NOW(),
    NOW()
FROM users u WHERE u.email = 'admin@portfolio.dev'
ON CONFLICT (entreprise, poste) DO NOTHING;

INSERT INTO experience_realisations (experience_id, position, realisation)
SELECT e.id, v.position, v.realisation
FROM experiences e
CROSS JOIN (VALUES
    (0, 'PFM : agrégation de comptes externes et catégorisation des dépenses ; parcours de souscription crédit immobilier, assurance-vie et auto (PHP/Symfony 3 + AngularJS)'),
    (1, 'Back-offices AngularJS : gestion des incidents, droits utilisateurs, dates boursières, diffusion des messages Boursorama')
) AS v(position, realisation)
WHERE e.entreprise = 'Boursorama' AND e.poste = 'Développeur Fullstack PHP / Java'
AND NOT EXISTS (SELECT 1 FROM experience_realisations er WHERE er.experience_id = e.id);

INSERT INTO experience_stack (experience_id, position, techno)
SELECT e.id, v.position, v.techno
FROM experiences e
CROSS JOIN (VALUES
    (0, 'Java 8'),
    (1, 'Spring Boot'),
    (2, 'AngularJS'),
    (3, 'Symfony 3'),
    (4, 'MongoDB'),
    (5, 'Redis'),
    (6, 'Jenkins')
) AS v(position, techno)
WHERE e.entreprise = 'Boursorama' AND e.poste = 'Développeur Fullstack PHP / Java'
AND NOT EXISTS (SELECT 1 FROM experience_stack es WHERE es.experience_id = e.id);
