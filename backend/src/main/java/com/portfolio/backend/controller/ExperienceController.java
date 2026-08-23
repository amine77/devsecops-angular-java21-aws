package com.portfolio.backend.controller;

import com.portfolio.backend.dto.request.ExperienceRequest;
import com.portfolio.backend.dto.response.ApiResponse;
import com.portfolio.backend.dto.response.ExperienceResponse;
import com.portfolio.backend.service.ExperienceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
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
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/experiences")
@Tag(name = "Expériences", description = "Parcours professionnel (missions en entreprise)")
public class ExperienceController {

    private final ExperienceService experienceService;

    public ExperienceController(ExperienceService experienceService) {
        this.experienceService = experienceService;
    }

    @GetMapping
    @Operation(summary = "Liste du parcours professionnel",
        description = "Retourne toutes les expériences, triées par ordre d'affichage")
    public ResponseEntity<ApiResponse<List<ExperienceResponse>>> getAllExperiences() {
        return ResponseEntity.ok(ApiResponse.success(experienceService.getAll()));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Détail d'une expérience")
    public ResponseEntity<ApiResponse<ExperienceResponse>> getExperienceById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(experienceService.getById(id)));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Créer une expérience", security = @SecurityRequirement(name = "bearerAuth"))
    public ResponseEntity<ApiResponse<ExperienceResponse>> createExperience(
        @Valid @RequestBody ExperienceRequest request
    ) {
        ExperienceResponse created = experienceService.createExperience(request);
        return ResponseEntity
            .status(HttpStatus.CREATED)
            .body(ApiResponse.success(created, "Expérience créée avec succès"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Modifier une expérience", security = @SecurityRequirement(name = "bearerAuth"))
    public ResponseEntity<ApiResponse<ExperienceResponse>> updateExperience(
        @PathVariable Long id,
        @Valid @RequestBody ExperienceRequest request
    ) {
        return ResponseEntity.ok(
            ApiResponse.success(experienceService.updateExperience(id, request), "Expérience mise à jour")
        );
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Supprimer une expérience", security = @SecurityRequirement(name = "bearerAuth"))
    public ResponseEntity<Void> deleteExperience(@PathVariable Long id) {
        experienceService.deleteExperience(id);
        return ResponseEntity.noContent().build();
    }
}
