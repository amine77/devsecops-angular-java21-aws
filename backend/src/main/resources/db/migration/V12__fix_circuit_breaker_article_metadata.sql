-- =============================================================================
-- V12__fix_circuit_breaker_article_metadata.sql — Corrige title/summary
-- =============================================================================
-- L'article avait été publié avec title et summary égaux au slug (oubli lors
-- de la saisie), au lieu du contenu éditorial prévu.
-- =============================================================================

UPDATE articles
SET title      = 'Circuit Breaker : arrêter la panne avant qu''elle ne se propage',
    summary    = 'Un service tombe. Trente secondes plus tard, c''est toute l''application qui ne répond plus. Comment configurer correctement le pattern Circuit Breaker avec Resilience4j et Spring Boot 3.',
    updated_at = NOW()
WHERE slug = 'circuit-breaker-resilience4j';
