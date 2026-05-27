package com.portfolio.backend.service;

import com.portfolio.backend.dto.request.ProjectRequest;
import com.portfolio.backend.dto.response.ProjectResponse;
import com.portfolio.backend.entity.Project;
import com.portfolio.backend.entity.ProjectStatus;
import com.portfolio.backend.exception.ResourceNotFoundException;
import com.portfolio.backend.mapper.ProjectMapper;
import com.portfolio.backend.repository.ProjectRepository;
import com.portfolio.backend.repository.SkillRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * Tests unitaires du ProjectService.
 *
 * <p>Stratégie :
 * - @ExtendWith(MockitoExtension) : pas de Spring Context = tests ultra-rapides
 * - @Mock : les dépendances sont des mocks (pas de vraie DB)
 * - @InjectMocks : Spring injecte les mocks dans le service
 *
 * <p>On teste la LOGIQUE MÉTIER uniquement, pas la persistance.
 * Les repositories sont mockés → tests isolés et déterministes.
 *
 * <p>BDD Style (Given/When/Then) : rend les tests lisibles comme une spec.
 *
 * <p>@Nested : regroupe les tests par fonctionnalité pour une meilleure lecture.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ProjectService — Tests unitaires")
class ProjectServiceTest {

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private SkillRepository skillRepository;

    @Mock
    private ProjectMapper projectMapper;

    @InjectMocks
    private ProjectService projectService;

    private Project testProject;
    private ProjectResponse testProjectResponse;

    @BeforeEach
    void setUp() {
        testProject = Project.builder()
            .id(1L)
            .title("Portfolio DevSecOps")
            .description("Application cloud native avec Angular, Spring Boot, Kubernetes")
            .status(ProjectStatus.ACTIVE)
            .featured(true)
            .sortOrder(1)
            .build();

        testProjectResponse = new ProjectResponse(
            1L, "Portfolio DevSecOps",
            "Application cloud native avec Angular, Spring Boot, Kubernetes",
            null, null, null, null,
            ProjectStatus.ACTIVE, true, 1, List.of(), null, null
        );
    }

    @Nested
    @DisplayName("getProjectById()")
    class GetProjectByIdTests {

        @Test
        @DisplayName("Retourne le projet quand l'ID existe")
        void shouldReturnProjectWhenIdExists() {
            // GIVEN
            given(projectRepository.findById(1L)).willReturn(Optional.of(testProject));
            given(projectMapper.toResponse(testProject)).willReturn(testProjectResponse);

            // WHEN
            ProjectResponse result = projectService.getProjectById(1L);

            // THEN
            assertThat(result).isNotNull();
            assertThat(result.id()).isEqualTo(1L);
            assertThat(result.title()).isEqualTo("Portfolio DevSecOps");
            verify(projectRepository).findById(1L);
        }

        @Test
        @DisplayName("Lance ResourceNotFoundException quand l'ID n'existe pas")
        void shouldThrowNotFoundWhenIdDoesNotExist() {
            // GIVEN
            given(projectRepository.findById(99L)).willReturn(Optional.empty());

            // WHEN / THEN
            assertThatThrownBy(() -> projectService.getProjectById(99L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Projet")
                .hasMessageContaining("99");

            // Vérifier que le mapper n'est PAS appelé si le projet n'existe pas
            verify(projectMapper, never()).toResponse(any());
        }
    }

    @Nested
    @DisplayName("createProject()")
    class CreateProjectTests {

        @Test
        @DisplayName("Crée et retourne le projet avec les données correctes")
        void shouldCreateProjectSuccessfully() {
            // GIVEN
            ProjectRequest request = new ProjectRequest(
                "Nouveau Projet", "Description détaillée du projet",
                "Résumé", "https://github.com/test", null, null,
                true, 1, List.of()
            );

            given(projectRepository.save(any(Project.class))).willReturn(testProject);
            given(projectMapper.toResponse(testProject)).willReturn(testProjectResponse);

            // WHEN
            ProjectResponse result = projectService.createProject(request);

            // THEN
            assertThat(result).isNotNull();
            verify(projectRepository).save(any(Project.class));
        }
    }

    @Nested
    @DisplayName("deleteProject() — soft delete")
    class DeleteProjectTests {

        @Test
        @DisplayName("Archive le projet (soft delete) au lieu de le supprimer")
        void shouldArchiveProjectInsteadOfDeleting() {
            // GIVEN
            given(projectRepository.findById(1L)).willReturn(Optional.of(testProject));
            given(projectRepository.save(any(Project.class))).willReturn(testProject);

            // WHEN
            projectService.deleteProject(1L);

            // THEN — Le projet est archivé, pas supprimé
            assertThat(testProject.getStatus()).isEqualTo(ProjectStatus.ARCHIVED);
            verify(projectRepository).save(testProject);
            // deleteById ne doit JAMAIS être appelé (soft delete)
            verify(projectRepository, never()).deleteById(any());
        }

        @Test
        @DisplayName("Lance ResourceNotFoundException si le projet n'existe pas")
        void shouldThrowNotFoundWhenProjectDoesNotExist() {
            // GIVEN
            given(projectRepository.findById(99L)).willReturn(Optional.empty());

            // WHEN / THEN
            assertThatThrownBy(() -> projectService.deleteProject(99L))
                .isInstanceOf(ResourceNotFoundException.class);
        }
    }
}
