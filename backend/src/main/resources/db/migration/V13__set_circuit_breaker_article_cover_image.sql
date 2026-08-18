-- =============================================================================
-- V13__set_circuit_breaker_article_cover_image.sql — Ajoute l'image de couverture
-- =============================================================================
-- L'image est servie en statique par le frontend (frontend/src/assets/images/
-- articles/), donc son URL publique suit le domaine de production.
-- =============================================================================

UPDATE articles
SET cover_image_url = 'https://charrad.dev/assets/images/articles/circuit-breaker-resilience4j.svg',
    updated_at       = NOW()
WHERE slug = 'circuit-breaker-resilience4j';
