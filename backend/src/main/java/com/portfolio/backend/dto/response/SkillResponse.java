package com.portfolio.backend.dto.response;

/**
 * DTO de réponse pour une compétence.
 */
public record SkillResponse(
    Long id,
    String name,
    String category,
    String iconUrl,
    String level,
    Integer sortOrder
) { }
