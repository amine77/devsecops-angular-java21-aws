package com.portfolio.backend.service;

import com.portfolio.backend.dto.response.SkillResponse;
import com.portfolio.backend.entity.Skill;
import com.portfolio.backend.mapper.ProjectMapper;
import com.portfolio.backend.repository.SkillRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@DisplayName("SkillService — Tests unitaires")
class SkillServiceTest {

    @Mock
    private SkillRepository skillRepository;

    @Mock
    private ProjectMapper projectMapper;

    @InjectMocks
    private SkillService skillService;

    private Skill buildSkill(String name, String category) {
        return Skill.builder().id(1L).name(name).category(category).sortOrder(1).build();
    }

    private SkillResponse buildSkillResponse(String name, String category) {
        return new SkillResponse(1L, name, category, null, 1, 1);
    }

    @Nested
    @DisplayName("getAllSkills()")
    class GetAllSkills {

        @Test
        @DisplayName("Retourne toutes les compétences triées par catégorie")
        void shouldReturnAllSkills() {
            Skill skill = buildSkill("Java", "BACKEND");
            SkillResponse response = buildSkillResponse("Java", "BACKEND");

            given(skillRepository.findAllByOrderByCategoryAscSortOrderAsc()).willReturn(List.of(skill));
            given(projectMapper.toSkillResponse(skill)).willReturn(response);

            List<SkillResponse> result = skillService.getAllSkills();

            assertThat(result).hasSize(1);
            assertThat(result.get(0).name()).isEqualTo("Java");
            verify(skillRepository).findAllByOrderByCategoryAscSortOrderAsc();
        }

        @Test
        @DisplayName("Retourne une liste vide si aucune compétence")
        void shouldReturnEmptyListWhenNoSkills() {
            given(skillRepository.findAllByOrderByCategoryAscSortOrderAsc()).willReturn(List.of());

            List<SkillResponse> result = skillService.getAllSkills();

            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("getSkillsByCategory()")
    class GetSkillsByCategory {

        @Test
        @DisplayName("Retourne les compétences filtrées par catégorie en majuscules")
        void shouldReturnSkillsByCategory() {
            Skill skill = buildSkill("Spring Boot", "BACKEND");
            SkillResponse response = buildSkillResponse("Spring Boot", "BACKEND");

            given(skillRepository.findByCategoryOrderBySortOrderAsc("BACKEND")).willReturn(List.of(skill));
            given(projectMapper.toSkillResponse(skill)).willReturn(response);

            List<SkillResponse> result = skillService.getSkillsByCategory("backend");

            assertThat(result).hasSize(1);
            assertThat(result.get(0).category()).isEqualTo("BACKEND");
            verify(skillRepository).findByCategoryOrderBySortOrderAsc("BACKEND");
        }

        @Test
        @DisplayName("Convertit la catégorie en majuscules avant la requête")
        void shouldConvertCategoryToUpperCase() {
            given(skillRepository.findByCategoryOrderBySortOrderAsc("FRONTEND")).willReturn(List.of());

            skillService.getSkillsByCategory("frontend");

            verify(skillRepository).findByCategoryOrderBySortOrderAsc("FRONTEND");
        }
    }
}
