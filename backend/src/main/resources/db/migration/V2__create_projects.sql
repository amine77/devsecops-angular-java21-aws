-- =============================================================================
-- V2__create_projects.sql — Table des projets portfolio
-- =============================================================================

CREATE TABLE projects (
    id           BIGSERIAL       PRIMARY KEY,
    title        VARCHAR(200)    NOT NULL,
    description  TEXT            NOT NULL,
    summary      VARCHAR(500),                       -- Résumé court (pour les cards)
    github_url   VARCHAR(500),
    demo_url     VARCHAR(500),
    image_url    VARCHAR(500),
    status       VARCHAR(50)     NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE, ARCHIVED
    featured     BOOLEAN         NOT NULL DEFAULT FALSE,     -- Mis en avant sur la homepage
    sort_order   INTEGER         NOT NULL DEFAULT 0,         -- Ordre d'affichage
    user_id      BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP       NOT NULL DEFAULT NOW()
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_featured ON projects(featured) WHERE featured = TRUE;
CREATE INDEX idx_projects_status   ON projects(status);

-- Commentaires
COMMENT ON TABLE projects IS 'Projets du portfolio';
COMMENT ON COLUMN projects.featured IS 'Si TRUE, affiché sur la homepage';
COMMENT ON COLUMN projects.sort_order IS 'Ordre d''affichage (0 = premier)';
