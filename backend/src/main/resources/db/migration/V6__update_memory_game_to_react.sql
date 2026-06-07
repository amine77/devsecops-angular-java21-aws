-- =============================================================================
-- V6__update_memory_game_to_react.sql — "Memory des Drapeaux" réécrit en React
-- =============================================================================
-- Le jeu, initialement en JavaScript natif, a été converti en React + TypeScript
-- (Vite, hooks personnalisés, tests Vitest/RTL) pour pratiquer ce framework.
-- Mise à jour de la description et des compétences associées en conséquence.
-- =============================================================================

-- Compétence manquante au seed initial
INSERT INTO skills (name, category, level, sort_order) VALUES
    ('React', 'FRONTEND', 4, 15)
ON CONFLICT (name) DO NOTHING;

UPDATE projects
SET description = 'Jeu de memory à deux joueurs basé sur les drapeaux du monde : 12 paires de pays à retrouver, tour par tour, avec score en temps réel et animation de retournement des cartes. Réécrit en React + TypeScript (Vite, hooks personnalisés, composants testés avec Vitest et React Testing Library), avec les images de drapeaux fournies par flagcdn.com.',
    summary     = 'Jeu de memory multijoueur en React + TypeScript — drapeaux du monde',
    updated_at  = NOW()
WHERE title = 'Memory des Drapeaux';

-- Retire les compétences de l'ancienne version (JS natif) au profit de React/TypeScript
DELETE FROM project_skills
WHERE project_id = (SELECT id FROM projects WHERE title = 'Memory des Drapeaux')
  AND skill_id IN (SELECT id FROM skills WHERE name IN ('JavaScript', 'HTML5 / CSS3'));

INSERT INTO project_skills (project_id, skill_id)
SELECT p.id, s.id
FROM projects p
JOIN skills s ON s.name IN ('React', 'TypeScript')
WHERE p.title = 'Memory des Drapeaux'
ON CONFLICT DO NOTHING;
