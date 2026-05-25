-- =============================================================================
-- V3__create_skills.sql — Tables compétences et liaison projets/compétences
-- =============================================================================

-- Table des compétences (Java, Angular, Docker, AWS, etc.)
CREATE TABLE skills (
    id          BIGSERIAL       PRIMARY KEY,
    name        VARCHAR(100)    NOT NULL UNIQUE,
    category    VARCHAR(100)    NOT NULL,    -- BACKEND, FRONTEND, DEVOPS, CLOUD, etc.
    icon_url    VARCHAR(500),
    level       INTEGER         NOT NULL DEFAULT 3 CHECK (level BETWEEN 1 AND 5),
    sort_order  INTEGER         NOT NULL DEFAULT 0,
    created_at  TIMESTAMP       NOT NULL DEFAULT NOW()
);

-- Table de liaison projets ↔ compétences (Many-to-Many)
-- Raison : un projet utilise plusieurs compétences, une compétence
-- apparaît dans plusieurs projets.
CREATE TABLE project_skills (
    project_id  BIGINT  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    skill_id    BIGINT  NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, skill_id)
);

-- Index
CREATE INDEX idx_skills_category ON skills(category);
CREATE INDEX idx_project_skills_project ON project_skills(project_id);
CREATE INDEX idx_project_skills_skill   ON project_skills(skill_id);

-- Données initiales (seed)
INSERT INTO skills (name, category, level, sort_order) VALUES
    ('Java 21',        'BACKEND',  5, 1),
    ('Spring Boot',    'BACKEND',  5, 2),
    ('PostgreSQL',     'BACKEND',  4, 3),
    ('Angular',        'FRONTEND', 5, 4),
    ('TypeScript',     'FRONTEND', 5, 5),
    ('Docker',         'DEVOPS',   4, 6),
    ('Kubernetes',     'DEVOPS',   4, 7),
    ('Helm',           'DEVOPS',   3, 8),
    ('Terraform',      'DEVOPS',   4, 9),
    ('AWS',            'CLOUD',    4, 10),
    ('GitHub Actions', 'DEVOPS',   4, 11),
    ('NGINX',          'DEVOPS',   3, 12);

COMMENT ON TABLE skills IS 'Compétences techniques du portfolio';
COMMENT ON COLUMN skills.level IS 'Niveau de 1 à 5 (5 = expert)';
