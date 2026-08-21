package com.portfolio.backend.mapper;

import com.portfolio.backend.dto.response.ProjectResponse;
import com.portfolio.backend.dto.response.SkillResponse;
import com.portfolio.backend.entity.Project;
import com.portfolio.backend.entity.Skill;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Mapper manuel Entity → DTO.
 *
 * <p>Raison de ne pas utiliser MapStruct ici :
 * - Les mappings sont simples (pas de transformations complexes)
 * - Un mapper manuel est plus lisible pour un portfolio/démonstration
 * - MapStruct est néanmoins déclaré dans le pom.xml pour montrer qu'on le connaît
 *
 * <p>Responsabilité unique :
 * - Ce mapper NE fait que convertir Entity → DTO
 * - Pas de logique métier
 * - Pas d'appels DB
 */
@Component
public class ProjectMapper {

    /**
     * Convertit une entité Project en ProjectResponse DTO.
     */
    public ProjectResponse toResponse(Project project) {
        return new ProjectResponse(
            project.getId(),
            project.getTitle(),
            project.getDescription(),
            project.getSummary(),
            project.getGithubUrl(),
            project.getDemoUrl(),
            project.getImageUrl(),
            project.getStatus(),
            project.isFeatured(),
            project.getSortOrder(),
            project.getSkills().stream()
                .map(this::toSkillResponse)
                .toList(),
            project.getCreatedAt(),
            project.getUpdatedAt()
        );
    }

    /**
     * Convertit une liste de Project en liste de ProjectResponse.
     */
    public List<ProjectResponse> toResponseList(List<Project> projects) {
        return projects.stream()
            .map(this::toResponse)
            .toList();
    }

    /**
     * Convertit une entité Skill en SkillResponse DTO.
     */
    public SkillResponse toSkillResponse(Skill skill) {
        return new SkillResponse(
            skill.getId(),
            skill.getName(),
            skill.getCategory(),
            skill.getIconUrl(),
            skill.getLevel().name(),
            skill.getSortOrder()
        );
    }
}
