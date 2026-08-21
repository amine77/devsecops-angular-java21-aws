-- =============================================================================
-- V20__set_remaining_project_screenshots.sql — Complète les captures d'écran
-- des deux projets restants, tous deux mis en vedette.
-- =============================================================================
-- "Portfolio DevSecOps" : la démo est le site lui-même (charrad.dev).
-- "API REST Spring Boot JWT" : capture de la documentation Swagger/OpenAPI
-- publiquement exposée (/api/v3/api-docs).
-- =============================================================================

UPDATE projects
SET image_url = 'https://charrad.dev/assets/images/projects/portfolio-devsecops.png',
    updated_at = NOW()
WHERE title = 'Portfolio DevSecOps';

UPDATE projects
SET image_url = 'https://charrad.dev/assets/images/projects/api-swagger.png',
    updated_at = NOW()
WHERE title = 'API REST Spring Boot JWT';
