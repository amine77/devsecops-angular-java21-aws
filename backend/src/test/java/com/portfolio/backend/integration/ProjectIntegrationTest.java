package com.portfolio.backend.integration;

import com.portfolio.backend.entity.Project;
import com.portfolio.backend.entity.ProjectStatus;
import com.portfolio.backend.repository.ProjectRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests d'intégration avec un vrai PostgreSQL via Testcontainers.
 *
 * <p>@Testcontainers : démarre automatiquement les containers Docker avant les tests.
 * @Container : déclare le container PostgreSQL (partagé entre tous les tests de la classe).
 *
 * <p>Raison d'utiliser Testcontainers plutôt que H2 :
 * - H2 ne supporte pas toutes les fonctionnalités PostgreSQL
 * - Les tests sont plus représentatifs de la prod
 * - Flyway migrations testées sur un vrai PostgreSQL
 *
 * <p>@DataJpaTest : charge UNIQUEMENT la couche JPA (pas tout le contexte Spring).
 * Tests de repository et de queries.
 *
 * <p>Prérequis : Docker doit être installé sur la machine de test.
 */
@DataJpaTest
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@DisplayName("ProjectRepository — Tests d'intégration (PostgreSQL réel)")
class ProjectIntegrationTest {

    /**
     * Container PostgreSQL partagé entre tous les tests.
     * Testcontainers gère le démarrage et l'arrêt automatiquement.
     */
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine")
        .withDatabaseName("portfolio_test")
        .withUsername("test_user")
        .withPassword("test_pass");

    /**
     * Surcharge dynamique des propriétés Spring avec les coordonnées du container.
     * Raison : le port du container est aléatoire (évite les conflits de port).
     */
    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private ProjectRepository projectRepository;

    @AfterEach
    void cleanup() {
        projectRepository.deleteAll();
    }

    @Test
    @DisplayName("Sauvegarde et retrouve un projet")
    void shouldSaveAndFindProject() {
        // GIVEN
        Project project = Project.builder()
            .title("Test Project")
            .description("Description de test pour Testcontainers")
            .status(ProjectStatus.ACTIVE)
            .featured(false)
            .sortOrder(1)
            .build();

        // WHEN
        Project saved = projectRepository.save(project);

        // THEN
        assertThat(saved.getId()).isNotNull();

        Optional<Project> found = projectRepository.findById(saved.getId());
        assertThat(found).isPresent();
        assertThat(found.get().getTitle()).isEqualTo("Test Project");
    }

    @Test
    @DisplayName("Filtre les projets actifs uniquement")
    void shouldFindOnlyActiveProjects() {
        // GIVEN — un projet actif et un archivé
        Project activeProject = Project.builder()
            .title("Projet Actif")
            .description("Description du projet actif")
            .status(ProjectStatus.ACTIVE)
            .featured(false)
            .sortOrder(1)
            .build();

        Project archivedProject = Project.builder()
            .title("Projet Archivé")
            .description("Description du projet archivé")
            .status(ProjectStatus.ARCHIVED)
            .featured(false)
            .sortOrder(2)
            .build();

        projectRepository.saveAll(List.of(activeProject, archivedProject));

        // WHEN
        List<Project> activeProjects = projectRepository
            .findAllActiveWithSkills(ProjectStatus.ACTIVE);

        // THEN — seul le projet actif doit apparaître
        assertThat(activeProjects).hasSize(1);
        assertThat(activeProjects.get(0).getTitle()).isEqualTo("Projet Actif");
    }

    @Test
    @DisplayName("Les projets featured sont correctement filtrés")
    void shouldFindOnlyFeaturedProjects() {
        // GIVEN
        Project featured = Project.builder()
            .title("Projet En Vedette")
            .description("Description du projet en vedette")
            .status(ProjectStatus.ACTIVE)
            .featured(true)
            .sortOrder(1)
            .build();

        Project notFeatured = Project.builder()
            .title("Projet Normal")
            .description("Description du projet normal")
            .status(ProjectStatus.ACTIVE)
            .featured(false)
            .sortOrder(2)
            .build();

        projectRepository.saveAll(List.of(featured, notFeatured));

        // WHEN
        List<Project> featuredProjects = projectRepository
            .findByFeaturedTrueAndStatusOrderBySortOrderAsc(ProjectStatus.ACTIVE);

        // THEN
        assertThat(featuredProjects).hasSize(1);
        assertThat(featuredProjects.get(0).isFeatured()).isTrue();
    }
}
