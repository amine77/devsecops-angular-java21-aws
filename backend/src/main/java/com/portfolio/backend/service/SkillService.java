package com.portfolio.backend.service;

import com.portfolio.backend.dto.response.SkillResponse;
import com.portfolio.backend.mapper.ProjectMapper;
import com.portfolio.backend.repository.SkillRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Service métier pour les compétences.
 */
@Service
@Transactional(readOnly = true)
public class SkillService {

    private final SkillRepository skillRepository;
    private final ProjectMapper projectMapper;

    public SkillService(SkillRepository skillRepository, ProjectMapper projectMapper) {
        this.skillRepository = skillRepository;
        this.projectMapper = projectMapper;
    }

    /**
     * Retourne toutes les compétences triées par catégorie.
     */
    public List<SkillResponse> getAllSkills() {
        return skillRepository.findAllByOrderByCategoryAscSortOrderAsc()
            .stream()
            .map(projectMapper::toSkillResponse)
            .toList();
    }

    /**
     * Retourne les compétences filtrées par catégorie.
     */
    public List<SkillResponse> getSkillsByCategory(String category) {
        return skillRepository.findByCategoryOrderBySortOrderAsc(category.toUpperCase())
            .stream()
            .map(projectMapper::toSkillResponse)
            .toList();
    }
}
