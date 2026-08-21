-- =============================================================================
-- V18__skills_level_enum.sql — Remplace le niveau pourcentage (1-5) par un niveau
-- nommé (EXPERT / AVANCE / INTERMEDIAIRE), et complète le catalogue de compétences.
-- =============================================================================
-- Raison : afficher "Java 21 — 100%" décrédibilise le profil auprès d'un lecteur
-- technique. On affiche désormais un niveau nommé (pastille colorée + libellé).
--
-- Mapping (l'ancien niveau 1-5 était affiché en front multiplié par 20, en %) :
--   niveau 5 (100%) → EXPERT
--   niveau 4 (80%)  → AVANCE
--   niveau <= 3 (<=60%) → INTERMEDIAIRE
-- =============================================================================

ALTER TABLE skills
    ADD COLUMN level_new VARCHAR(20);

UPDATE skills
SET level_new = CASE
    WHEN level >= 5 THEN 'EXPERT'
    WHEN level = 4  THEN 'AVANCE'
    ELSE 'INTERMEDIAIRE'
END;

ALTER TABLE skills DROP COLUMN level;
ALTER TABLE skills RENAME COLUMN level_new TO level;
ALTER TABLE skills ALTER COLUMN level SET NOT NULL;
ALTER TABLE skills ALTER COLUMN level SET DEFAULT 'INTERMEDIAIRE';
ALTER TABLE skills ADD CONSTRAINT skills_level_check CHECK (level IN ('EXPERT', 'AVANCE', 'INTERMEDIAIRE'));

COMMENT ON COLUMN skills.level IS 'Niveau de maîtrise : EXPERT, AVANCE, INTERMEDIAIRE';

-- Compétences manquantes, déjà citées dans le footer mais absentes de la page Compétences
INSERT INTO skills (name, category, level, sort_order) VALUES
    ('Kafka', 'BACKEND', 'AVANCE', 15),
    ('Redis', 'BACKEND', 'AVANCE', 16)
ON CONFLICT (name) DO NOTHING;

INSERT INTO skills (name, category, level, sort_order) VALUES
    ('JUnit 5',    'QUALITY', 'EXPERT',        20),
    ('Cypress',    'QUALITY', 'AVANCE',        21),
    ('Gatling',    'QUALITY', 'INTERMEDIAIRE', 22),
    ('SonarCloud', 'QUALITY', 'AVANCE',        23)
ON CONFLICT (name) DO NOTHING;
