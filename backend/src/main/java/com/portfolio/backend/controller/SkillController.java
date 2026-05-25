package com.portfolio.backend.controller;

import com.portfolio.backend.dto.response.ApiResponse;
import com.portfolio.backend.dto.response.SkillResponse;
import com.portfolio.backend.service.SkillService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Controller REST pour les compétences.
 * Tous les endpoints sont publics (lecture seule).
 */
@RestController
@RequestMapping("/skills")
@Tag(name = "Compétences", description = "Consultation des compétences techniques")
public class SkillController {

    private final SkillService skillService;

    public SkillController(SkillService skillService) {
        this.skillService = skillService;
    }

    /**
     * GET /skills — Toutes les compétences.
     * Paramètre optionnel ?category=BACKEND pour filtrer.
     */
    @GetMapping
    @Operation(summary = "Liste des compétences")
    public ResponseEntity<ApiResponse<List<SkillResponse>>> getAllSkills(
        @RequestParam(required = false) String category
    ) {
        List<SkillResponse> skills = category != null
            ? skillService.getSkillsByCategory(category)
            : skillService.getAllSkills();
        return ResponseEntity.ok(ApiResponse.success(skills));
    }
}
