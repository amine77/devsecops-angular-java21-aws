package com.portfolio.backend.repository;

import com.portfolio.backend.entity.Skill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository JPA pour les compétences.
 */
@Repository
public interface SkillRepository extends JpaRepository<Skill, Long> {

    /**
     * Toutes les compétences triées par catégorie puis par ordre d'affichage.
     */
    List<Skill> findAllByOrderByCategoryAscSortOrderAsc();

    /**
     * Compétences filtrées par catégorie.
     */
    List<Skill> findByCategoryOrderBySortOrderAsc(String category);
}
