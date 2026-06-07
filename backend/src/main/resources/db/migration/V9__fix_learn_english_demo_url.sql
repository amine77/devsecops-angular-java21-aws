-- =============================================================================
-- V9__fix_learn_english_demo_url.sql — Corrige le demo_url d'"English Boost"
-- =============================================================================
-- L'app utilise React Router avec un "basename" dédié : une URL terminant par
-- /index.html ne correspond à aucune route déclarée (/, /cartes, /fiches, /qcm)
-- une fois le basename retiré, et la page reste donc blanche.
-- L'URL correcte est la racine du sous-dossier (avec slash final), qui
-- correspond à la route index "/".
-- =============================================================================

UPDATE projects
SET demo_url   = '/assets/games/learn-english/',
    updated_at = NOW()
WHERE title = 'English Boost';
