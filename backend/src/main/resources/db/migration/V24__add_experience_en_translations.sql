-- =============================================================================
-- V24__add_experience_en_translations.sql — Traductions anglaises des missions.
-- =============================================================================
-- Ajoute les variantes anglaises de poste/contexte/description (colonnes
-- nullables : NULL = pas de traduction, le frontend retombe alors sur le
-- français) ainsi qu'une table experience_realisations_en parallèle à
-- experience_realisations. entreprise, dates et stack restent non traduits.
--
-- Traduction professionnelle (pas littérale) des 3 missions existantes,
-- termes techniques conservés en anglais (Tech Lead, microservices, pipeline,
-- mentoring, ...).
-- =============================================================================

ALTER TABLE experiences ADD COLUMN poste_en       VARCHAR(200);
ALTER TABLE experiences ADD COLUMN contexte_en    VARCHAR(500);
ALTER TABLE experiences ADD COLUMN description_en TEXT;

CREATE TABLE experience_realisations_en (
    experience_id BIGINT       NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
    position      INTEGER      NOT NULL,
    realisation   TEXT         NOT NULL
);

CREATE INDEX idx_experience_realisations_en_exp_id ON experience_realisations_en(experience_id);

-- =============================================================================
-- ALLIANZ FRANCE
-- =============================================================================

UPDATE experiences
SET poste_en = 'Tech Lead / Senior Java Angular & DevSecOps Engineer',
    contexte_en = 'International insurance group — Strategic Life & Borrower projects',
    description_en = 'Hands-on lead (80% coding, 20% management) of a 4-developer Agile Scrum team including 2 juniors under mentoring. Requirements framing with POs, target architecture definition with group architects.'
WHERE entreprise = 'Allianz France' AND poste = 'Tech Lead / Ingénieur Senior Java Angular & DevSecOps';

INSERT INTO experience_realisations_en (experience_id, position, realisation)
SELECT e.id, v.position, v.realisation
FROM experiences e
CROSS JOIN (VALUES
    (0, 'Compliance: rewrote a critical monolith into 5 REST microservices over 18 months (OpenAPI/Swagger, Angular 20, AWS EKS/ECR)'),
    (1, 'OIDC authentication via Azure AD, Kafka event streaming, Amazon RDS data'),
    (2, 'DevSecOps GitHub Actions pipeline: SAST/DAST (CodeQL, OWASP ZAP), Trivy, Cosign, CycloneDX SBOM — SonarQube coverage > 80%'),
    (3, 'AWS infrastructure via Terraform, GitOps deployment with ArgoCD/Helm'),
    (4, 'OAE — Borrower Insurance: iPad sales application for ~100 sales reps, 12 screens, ~250 quotes per month'),
    (5, 'TDD/BDD testing: JUnit/Mockito, Cucumber/Testcontainers, Cypress, Gatling load testing (p95/p99)')
) AS v(position, realisation)
WHERE e.entreprise = 'Allianz France' AND e.poste = 'Tech Lead / Ingénieur Senior Java Angular & DevSecOps'
AND NOT EXISTS (SELECT 1 FROM experience_realisations_en er WHERE er.experience_id = e.id);

-- =============================================================================
-- SOCIÉTÉ GÉNÉRALE SECURITIES SERVICES
-- =============================================================================

UPDATE experiences
SET poste_en = 'Fullstack Java/JEE Angular Developer',
    contexte_en = 'Securities custody division — Société Générale',
    description_en = 'RST — SGSS Third-Party Repository: development of the portal aggregating reference data feeds for the securities custody division, plus production monitoring.'
WHERE entreprise = 'Société Générale Securities Services' AND poste = 'Développeur Fullstack Java/JEE Angular';

INSERT INTO experience_realisations_en (experience_id, position, realisation)
SELECT e.id, v.position, v.realisation
FROM experiences e
CROSS JOIN (VALUES
    (0, 'RST — SGSS Third-Party Repository: aggregation of reference data feeds (clients, accounts, mutual funds) exposed via a Java 8/Spring Boot/AngularJS portal and CSV exports'),
    (1, 'Production support: sanity checks, SUMMIT/CRM data loading, Control-M batch monitoring')
) AS v(position, realisation)
WHERE e.entreprise = 'Société Générale Securities Services' AND e.poste = 'Développeur Fullstack Java/JEE Angular'
AND NOT EXISTS (SELECT 1 FROM experience_realisations_en er WHERE er.experience_id = e.id);

-- =============================================================================
-- BOURSORAMA
-- =============================================================================

UPDATE experiences
SET poste_en = 'Fullstack PHP / Java Developer',
    contexte_en = 'Online bank — France''s leading online broker',
    description_en = 'Development of subscription journeys (mortgage, life insurance, car loans) and back-office tools for the online bank Boursorama.'
WHERE entreprise = 'Boursorama' AND poste = 'Développeur Fullstack PHP / Java';

INSERT INTO experience_realisations_en (experience_id, position, realisation)
SELECT e.id, v.position, v.realisation
FROM experiences e
CROSS JOIN (VALUES
    (0, 'PFM: external account aggregation and expense categorization; subscription journeys for mortgage, life insurance and car loans (PHP/Symfony 3 + AngularJS)'),
    (1, 'AngularJS back-offices: incident management, user rights, market dates, Boursorama message broadcasting')
) AS v(position, realisation)
WHERE e.entreprise = 'Boursorama' AND e.poste = 'Développeur Fullstack PHP / Java'
AND NOT EXISTS (SELECT 1 FROM experience_realisations_en er WHERE er.experience_id = e.id);
