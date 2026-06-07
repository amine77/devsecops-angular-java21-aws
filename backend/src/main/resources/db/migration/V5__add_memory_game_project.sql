-- =============================================================================
-- V5__add_memory_game_project.sql — Ajout du projet "Memory des Drapeaux"
-- =============================================================================
-- Mini-jeu HTML/CSS/JS (memory à 2 joueurs sur les drapeaux du monde),
-- servi en statique par le frontend (NGINX) à /assets/games/memory-drapeaux/.
-- =============================================================================

-- Compétences front utilisées par ce projet (absentes du seed initial)
INSERT INTO skills (name, category, level, sort_order) VALUES
    ('JavaScript',  'FRONTEND', 4, 13),
    ('HTML5 / CSS3','FRONTEND', 4, 14)
ON CONFLICT (name) DO NOTHING;

INSERT INTO projects (title, description, summary, github_url, demo_url, status, featured, sort_order, user_id, created_at, updated_at)
SELECT
    'Memory des Drapeaux',
    'Jeu de memory à deux joueurs basé sur les drapeaux du monde : 12 paires de pays à retrouver, tour par tour, avec score en temps réel et animation de retournement des cartes. Réalisé en HTML, CSS et JavaScript natif (sans framework), avec les images de drapeaux fournies par flagcdn.com.',
    'Jeu de memory multijoueur en JavaScript natif — drapeaux du monde',
    NULL,
    '/assets/games/memory-drapeaux/index.html',
    'ACTIVE',
    FALSE,
    3,
    u.id,
    NOW(),
    NOW()
FROM users u WHERE u.email = 'admin@portfolio.dev'
ON CONFLICT DO NOTHING;

-- Liaisons projet ↔ compétences
INSERT INTO project_skills (project_id, skill_id)
SELECT p.id, s.id
FROM projects p
JOIN skills s ON s.name IN ('JavaScript', 'HTML5 / CSS3')
WHERE p.title = 'Memory des Drapeaux'
ON CONFLICT DO NOTHING;
