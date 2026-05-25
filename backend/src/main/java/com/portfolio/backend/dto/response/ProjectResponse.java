package com.portfolio.backend.dto.response;

import com.portfolio.backend.entity.ProjectStatus;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO de réponse pour un projet.
 *
 * <p>Raison de ne pas retourner l'entité Project directement :
 * - L'entité a des relations JPA qui peuvent causer des problèmes de sérialisation
 * - On contrôle exactement ce qui est exposé (ex: pas d'info sur l'user propriétaire)
 * - On peut renommer/reshaper les données sans toucher au schéma DB
 */
public record ProjectResponse(
    Long id,
    String title,
    String description,
    String summary,
    String githubUrl,
    String demoUrl,
    String imageUrl,
    ProjectStatus status,
    boolean featured,
    Integer sortOrder,
    List<SkillResponse> skills,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) { }
