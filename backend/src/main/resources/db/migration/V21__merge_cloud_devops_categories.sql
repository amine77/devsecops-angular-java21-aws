-- =============================================================================
-- V21__merge_cloud_devops_categories.sql — Fusionne les catégories "CLOUD" et
-- "DEVOPS" en une seule "CLOUD_DEVOPS", AWS en tête.
-- =============================================================================
-- Raison : la catégorie "Cloud" ne contenait qu'une seule compétence (AWS),
-- ce qui donnait une section qui paraissait vide sur la page Compétences.
-- =============================================================================

UPDATE skills SET category = 'CLOUD_DEVOPS' WHERE category IN ('CLOUD', 'DEVOPS');

-- Renumérotation pour qu'AWS apparaisse en premier dans la catégorie fusionnée
UPDATE skills SET sort_order = 6  WHERE name = 'AWS';
UPDATE skills SET sort_order = 7  WHERE name = 'Docker';
UPDATE skills SET sort_order = 8  WHERE name = 'Kubernetes';
UPDATE skills SET sort_order = 9  WHERE name = 'Helm';
UPDATE skills SET sort_order = 10 WHERE name = 'Terraform';
UPDATE skills SET sort_order = 11 WHERE name = 'GitHub Actions';
UPDATE skills SET sort_order = 12 WHERE name = 'NGINX';
