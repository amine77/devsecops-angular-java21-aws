-- =============================================================================
-- V19__set_project_screenshots.sql — Ajoute les captures d'écran des projets
-- disposant d'une démo publique.
-- =============================================================================
-- Captures réalisées avec Playwright (1200x630) sur les démos réellement
-- accessibles publiquement. Les deux autres projets ("Portfolio DevSecOps",
-- "API REST Spring Boot JWT") n'ont pas de demo_url public et gardent le
-- placeholder par défaut du frontend.
-- =============================================================================

UPDATE projects
SET image_url = 'https://charrad.dev/assets/images/projects/memory-drapeaux.png',
    updated_at = NOW()
WHERE title = 'Memory des Drapeaux';

UPDATE projects
SET image_url = 'https://charrad.dev/assets/images/projects/learn-english.png',
    updated_at = NOW()
WHERE title = 'English Boost';
