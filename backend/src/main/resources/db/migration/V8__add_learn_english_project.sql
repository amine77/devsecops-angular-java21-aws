-- =============================================================================
-- V8__add_learn_english_project.sql — Ajout du projet "English Boost"
-- =============================================================================
-- Application React + TypeScript pour apprendre l'anglais (cartes mémo,
-- fiches de révision, QCM par niveau), servie en statique par le frontend
-- (NGINX) à /assets/games/learn-english/, code source publié sur GitHub.
-- =============================================================================

INSERT INTO projects (title, description, summary, github_url, demo_url, status, featured, sort_order, user_id, created_at, updated_at)
SELECT
    'English Boost',
    'Application web pour apprendre l''anglais du collège au bac : cartes de vocabulaire façon flashcards, fiches de révision sur la grammaire et la méthodologie, et QCM corrigés et expliqués, le tout organisé par niveau (débutant, intermédiaire, avancé) et par thème. Réalisée en React + TypeScript (Vite, React Router), avec un contenu pédagogique typé en TypeScript.',
    'Application React + TypeScript pour apprendre l''anglais — cartes mémo, fiches et QCM',
    'https://github.com/amine77/learn-english',
    '/assets/games/learn-english/index.html',
    'ACTIVE',
    FALSE,
    4,
    u.id,
    NOW(),
    NOW()
FROM users u WHERE u.email = 'admin@portfolio.dev'
ON CONFLICT DO NOTHING;

-- Liaisons projet ↔ compétences (React et TypeScript déjà seedés via V6 / V3)
INSERT INTO project_skills (project_id, skill_id)
SELECT p.id, s.id
FROM projects p
JOIN skills s ON s.name IN ('React', 'TypeScript')
WHERE p.title = 'English Boost'
ON CONFLICT DO NOTHING;
