-- =============================================================================
-- V22__archive_api_rest_project.sql — Archive le projet "API REST Spring Boot
-- JWT" (retiré de la liste publique des projets, sur demande).
-- =============================================================================
-- Archivage (status = 'ARCHIVED') plutôt que suppression : cohérent avec le
-- mécanisme déjà en place (ProjectService.archiveProject / status ACTIVE-
-- ARCHIVED), et réversible si besoin.
-- =============================================================================

UPDATE projects
SET status = 'ARCHIVED',
    updated_at = NOW()
WHERE title = 'API REST Spring Boot JWT';
