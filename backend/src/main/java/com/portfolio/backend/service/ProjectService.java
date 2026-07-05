package com.portfolio.backend.service;

import com.portfolio.backend.config.CacheConfig;
import com.portfolio.backend.dto.request.ProjectRequest;
import com.portfolio.backend.dto.response.PageResponse;
import com.portfolio.backend.dto.response.ProjectResponse;
import com.portfolio.backend.entity.Project;
import com.portfolio.backend.entity.ProjectStatus;
import com.portfolio.backend.entity.Skill;
import com.portfolio.backend.entity.User;
import com.portfolio.backend.exception.ResourceNotFoundException;
import com.portfolio.backend.kafka.EventPublisher;
import com.portfolio.backend.kafka.event.ProjectCreatedEvent;
import com.portfolio.backend.mapper.ProjectMapper;
import com.portfolio.backend.repository.ProjectRepository;
import com.portfolio.backend.repository.SkillRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Service métier pour la gestion des projets.
 *
 * <p>Responsabilités :
 * - Orchestrer les opérations CRUD sur les projets
 * - Appliquer la logique métier (validation, transformations)
 * - Déléguer la persistance au Repository
 * - Déléguer le mapping au Mapper
 *
 * <p>@Transactional au niveau de la classe :
 * Chaque méthode est dans une transaction par défaut.
 * Les méthodes en lecture seule utilisent @Transactional(readOnly = true)
 * pour optimiser les performances (Hibernate ne fait pas de dirty checking).
 */
@Service
@Transactional
public class ProjectService {

    private static final Logger log = LoggerFactory.getLogger(ProjectService.class);

    private final ProjectRepository projectRepository;
    private final SkillRepository skillRepository;
    private final ProjectMapper projectMapper;
    private final EventPublisher eventPublisher;

    public ProjectService(
        ProjectRepository projectRepository,
        SkillRepository skillRepository,
        ProjectMapper projectMapper,
        EventPublisher eventPublisher
    ) {
        this.projectRepository = projectRepository;
        this.skillRepository = skillRepository;
        this.projectMapper = projectMapper;
        this.eventPublisher = eventPublisher;
    }

    /**
     * Récupère tous les projets actifs avec pagination.
     *
     * @param pageable paramètres de pagination (page, size, sort)
     * @return page de projets
     */
    @Cacheable(value = CacheConfig.CACHE_PROJECTS)
    @Transactional(readOnly = true)
    public PageResponse<ProjectResponse> getAllActiveProjects(Pageable pageable) {
        Page<Project> page = projectRepository
            .findByStatusOrderBySortOrderAsc(ProjectStatus.ACTIVE, pageable);
        Page<ProjectResponse> responsePage = page.map(projectMapper::toResponse);
        return PageResponse.from(responsePage);
    }

    /**
     * Récupère les projets mis en avant pour la homepage.
     */
    @Cacheable(value = CacheConfig.CACHE_PROJECTS_FEATURED)
    @Transactional(readOnly = true)
    public List<ProjectResponse> getFeaturedProjects() {
        return projectMapper.toResponseList(
            projectRepository.findByFeaturedTrueAndStatusOrderBySortOrderAsc(ProjectStatus.ACTIVE)
        );
    }

    /**
     * Récupère un projet par son ID.
     *
     * @param id l'ID du projet
     * @return le projet trouvé
     * @throws ResourceNotFoundException si le projet n'existe pas
     */
    @Cacheable(value = CacheConfig.CACHE_PROJECT, key = "#id")
    @Transactional(readOnly = true)
    public ProjectResponse getProjectById(Long id) {
        Project project = findProjectOrThrow(id);
        return projectMapper.toResponse(project);
    }

    /**
     * Crée un nouveau projet.
     *
     * @param request les données du projet
     * @return le projet créé
     */
    @Caching(evict = {
        @CacheEvict(value = CacheConfig.CACHE_PROJECTS, allEntries = true),
        @CacheEvict(value = CacheConfig.CACHE_PROJECTS_FEATURED, allEntries = true)
    })
    public ProjectResponse createProject(ProjectRequest request) {
        log.info("Création d'un nouveau projet: {}", request.title());

        User currentUser = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        List<Skill> skills = resolveSkills(request.skillIds());

        Project project = Project.builder()
            .title(request.title())
            .description(request.description())
            .summary(request.summary())
            .githubUrl(request.githubUrl())
            .demoUrl(request.demoUrl())
            .imageUrl(request.imageUrl())
            .featured(request.featured())
            .sortOrder(request.sortOrder() != null ? request.sortOrder() : 0)
            .status(ProjectStatus.ACTIVE)
            .skills(skills)
            .user(currentUser)
            .build();

        Project savedProject = projectRepository.save(project);
        log.info("Projet créé avec l'ID: {}", savedProject.getId());

        // Publie l'événement d'audit sur Kafka (fire-and-forget)
        String author = SecurityContextHolder.getContext().getAuthentication().getName();
        eventPublisher.publishProjectCreatedEvent(
            ProjectCreatedEvent.of(savedProject.getId(), savedProject.getTitle(), author)
        );

        return projectMapper.toResponse(savedProject);
    }

    /**
     * Met à jour un projet existant.
     *
     * @param id l'ID du projet à modifier
     * @param request les nouvelles données
     * @return le projet mis à jour
     * @throws ResourceNotFoundException si le projet n'existe pas
     */
    @Caching(evict = {
        @CacheEvict(value = CacheConfig.CACHE_PROJECTS, allEntries = true),
        @CacheEvict(value = CacheConfig.CACHE_PROJECTS_FEATURED, allEntries = true),
        @CacheEvict(value = CacheConfig.CACHE_PROJECT, key = "#id")
    })
    public ProjectResponse updateProject(Long id, ProjectRequest request) {
        log.info("Mise à jour du projet ID: {}", id);

        Project project = findProjectOrThrow(id);
        List<Skill> skills = resolveSkills(request.skillIds());

        project.setTitle(request.title());
        project.setDescription(request.description());
        project.setSummary(request.summary());
        project.setGithubUrl(request.githubUrl());
        project.setDemoUrl(request.demoUrl());
        project.setImageUrl(request.imageUrl());
        project.setFeatured(request.featured());
        project.setSortOrder(request.sortOrder() != null ? request.sortOrder() : project.getSortOrder());
        project.setSkills(skills);
        project.setUpdatedAt(LocalDateTime.now());

        Project savedProject = projectRepository.save(project);
        return projectMapper.toResponse(savedProject);
    }

    /**
     * Supprime (archive) un projet.
     * On préfère l'archivage à la suppression physique (soft delete).
     * Raison : traçabilité, possibilité de restaurer.
     *
     * @param id l'ID du projet à archiver
     * @throws ResourceNotFoundException si le projet n'existe pas
     */
    @Caching(evict = {
        @CacheEvict(value = CacheConfig.CACHE_PROJECTS, allEntries = true),
        @CacheEvict(value = CacheConfig.CACHE_PROJECTS_FEATURED, allEntries = true),
        @CacheEvict(value = CacheConfig.CACHE_PROJECT, key = "#id")
    })
    public void deleteProject(Long id) {
        log.info("Archivage du projet ID: {}", id);
        Project project = findProjectOrThrow(id);
        project.setStatus(ProjectStatus.ARCHIVED);
        project.setUpdatedAt(LocalDateTime.now());
        projectRepository.save(project);
    }

    // =========================================================================
    // Méthodes privées — helpers
    // =========================================================================

    /**
     * Charge un projet ou lance ResourceNotFoundException.
     * Pattern commun : évite la duplication du orElseThrow() partout.
     */
    private Project findProjectOrThrow(Long id) {
        return projectRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Projet", "id", id));
    }

    /**
     * Résout les IDs de skills en entités Skill.
     * Vérifie que tous les IDs existent en DB.
     */
    private List<Skill> resolveSkills(List<Long> skillIds) {
        if (skillIds == null || skillIds.isEmpty()) {
            return new ArrayList<>();
        }
        Set<Long> uniqueIds = new HashSet<>(skillIds);
        List<Skill> skills = skillRepository.findAllById(uniqueIds);
        if (skills.size() != uniqueIds.size()) {
            throw new ResourceNotFoundException("Une ou plusieurs compétences sont introuvables");
        }
        return skills;
    }
}
