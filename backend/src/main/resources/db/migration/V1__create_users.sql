-- =============================================================================
-- V1__create_users.sql — Migration Flyway
-- =============================================================================
-- Raison du nommage V{version}__{description}.sql :
--   V = version (obligatoire)
--   __ = double underscore (séparateur)
--   description = texte libre en snake_case
--
-- Flyway exécute ce script UNE SEULE FOIS et enregistre le checksum.
-- Si le fichier est modifié après exécution → erreur au démarrage.
-- Pour modifier le schéma, créer V2__, V3__, etc.
-- =============================================================================

-- Table des utilisateurs (pour l'authentification JWT)
CREATE TABLE users (
    id          BIGSERIAL       PRIMARY KEY,
    email       VARCHAR(255)    NOT NULL UNIQUE,
    password    VARCHAR(255)    NOT NULL,   -- BCrypt hash
    first_name  VARCHAR(100)    NOT NULL,
    last_name   VARCHAR(100)    NOT NULL,
    role        VARCHAR(50)     NOT NULL DEFAULT 'USER',
    enabled     BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP       NOT NULL DEFAULT NOW()
);

-- Index sur email (requête fréquente : findByEmail)
-- Raison : sans index, chaque login = full table scan
CREATE INDEX idx_users_email ON users(email);

-- Commentaires sur les colonnes (bonne pratique DBA)
COMMENT ON TABLE users IS 'Utilisateurs de l''application portfolio';
COMMENT ON COLUMN users.password IS 'Hash BCrypt du mot de passe — jamais en clair';
COMMENT ON COLUMN users.role IS 'ADMIN ou USER';
