package com.portfolio.backend.controller;

import com.portfolio.backend.dto.request.ProjectRequest;
import com.portfolio.backend.dto.response.ApiResponse;
import com.portfolio.backend.dto.response.PageResponse;
import com.portfolio.backend.dto.response.ProjectResponse;
import com.portfolio.backend.service.ProjectService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Controller REST pour les projets du portfolio.
 *
 * <p>Endpoints publics (GET) :
 * - GET /projects — Liste paginée de tous les projets actifs
 * - GET /projects/featured — Projets mis en avant
 * - GET /projects/{id} — Détail d'un projet
 *
 * <p>Endpoints admin (authentifié + ROLE_ADMIN) :
 * - POST /projects — Créer un projet
 * - PUT /projects/{id} — Modifier un projet
 * - DELETE /projects/{id} — Archiver un projet
 *
 * <p>Convention REST respectée :
 * - GET = lecture (idempotent)
 * - POST = création (retourne 201 Created)
 * - PUT = modification complète (idempotent)
 * - DELETE = suppression (retourne 204 No Content)
 */
@RestController
@RequestMapping("/projects")
@Tag(name = "Projets", description = "Gestion des projets du portfolio")
public class ProjectController {

    private final ProjectService projectService;

    public ProjectController(ProjectService projectService) {
        this.projectService = projectService;
    }

    /**
     * GET /projects?page=0&size=10&sort=sortOrder,asc
     * Liste paginée de tous les projets actifs.
     */
    @GetMapping
    @Operation(summary = "Liste des projets", description = "Retourne la liste paginée des projets actifs")
    public ResponseEntity<ApiResponse<PageResponse<ProjectResponse>>> getAllProjects(
        @Parameter(description = "Numéro de page (commence à 0)")
        @RequestParam(defaultValue = "0") int page,
        @Parameter(description = "Nombre d'éléments par page")
        @RequestParam(defaultValue = "10") int size,
        @Parameter(description = "Tri : 'sortOrder,asc' ou 'createdAt,desc'")
        @RequestParam(defaultValue = "sortOrder,asc") String sort
    ) {
        String[] sortParams = sort.split(",");
        Sort.Direction direction = sortParams.length > 1
            ? Sort.Direction.fromString(sortParams[1])
            : Sort.Direction.ASC;
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortParams[0]));
        return ResponseEntity.ok(ApiResponse.success(projectService.getAllActiveProjects(pageable)));
    }

    /**
     * GET /projects/featured — Projets mis en avant pour la homepage.
     */
    @GetMapping("/featured")
    @Operation(summary = "Projets en vedette", description = "Retourne les projets marqués comme 'featured'")
    public ResponseEntity<ApiResponse<List<ProjectResponse>>> getFeaturedProjects() {
        return ResponseEntity.ok(ApiResponse.success(projectService.getFeaturedProjects()));
    }

    /**
     * GET /projects/{id} — Détail d'un projet.
     */
    @GetMapping("/{id}")
    @Operation(summary = "Détail d'un projet")
    public ResponseEntity<ApiResponse<ProjectResponse>> getProjectById(
        @PathVariable Long id
    ) {
        return ResponseEntity.ok(ApiResponse.success(projectService.getProjectById(id)));
    }

    /**
     * POST /projects — Créer un projet.
     * Requiert ROLE_ADMIN.
     * Retourne 201 Created.
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
        summary = "Créer un projet",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<ApiResponse<ProjectResponse>> createProject(
        @Valid @RequestBody ProjectRequest request
    ) {
        ProjectResponse created = projectService.createProject(request);
        return ResponseEntity
            .status(HttpStatus.CREATED)
            .body(ApiResponse.success(created, "Projet créé avec succès"));
    }

    /**
     * PUT /projects/{id} — Modifier un projet.
     * Requiert ROLE_ADMIN.
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
        summary = "Modifier un projet",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<ApiResponse<ProjectResponse>> updateProject(
        @PathVariable Long id,
        @Valid @RequestBody ProjectRequest request
    ) {
        return ResponseEntity.ok(
            ApiResponse.success(projectService.updateProject(id, request), "Projet mis à jour")
        );
    }

    /**
     * DELETE /projects/{id} — Archiver un projet (soft delete).
     * Retourne 204 No Content.
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
        summary = "Archiver un projet",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<Void> deleteProject(@PathVariable Long id) {
        projectService.deleteProject(id);
        return ResponseEntity.noContent().build();
    }
}
