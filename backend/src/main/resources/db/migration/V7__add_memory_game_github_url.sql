-- =============================================================================
-- V7__add_memory_game_github_url.sql — Lien GitHub du code source du jeu
-- =============================================================================
-- Le code source de "Memory des Drapeaux" (React + TypeScript) est désormais
-- publié publiquement sur GitHub : https://github.com/amine77/memory-drapeaux
-- =============================================================================

UPDATE projects
SET github_url = 'https://github.com/amine77/memory-drapeaux',
    updated_at = NOW()
WHERE title = 'Memory des Drapeaux';
