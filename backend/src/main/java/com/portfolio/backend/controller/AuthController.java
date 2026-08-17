package com.portfolio.backend.controller;

import com.portfolio.backend.dto.request.ChangePasswordRequest;
import com.portfolio.backend.dto.request.LoginRequest;
import com.portfolio.backend.dto.response.ApiResponse;
import com.portfolio.backend.dto.response.AuthResponse;
import com.portfolio.backend.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Controller REST pour l'authentification.
 *
 * <p>Responsabilités :
 * - Recevoir les requêtes HTTP
 * - Valider les inputs (@Valid)
 * - Déléguer au Service
 * - Retourner la réponse HTTP appropriée
 *
 * <p>Le Controller NE CONTIENT PAS de logique métier.
 * Raison : Single Responsibility — le controller gère le HTTP,
 * le service gère la logique.
 *
 * <p>@RestController = @Controller + @ResponseBody
 * @RequestMapping("/auth") : préfixe de toutes les URLs de ce controller
 */
@RestController
@RequestMapping("/auth")
@Tag(name = "Authentification", description = "Endpoints de connexion et gestion des tokens JWT")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /**
     * POST /auth/login — Authentifie un utilisateur et retourne un JWT.
     *
     * <p>@Valid : déclenche la validation Bean Validation sur LoginRequest
     * Si invalide → MethodArgumentNotValidException → GlobalExceptionHandler → 400
     */
    @PostMapping("/login")
    @Operation(
        summary = "Connexion utilisateur",
        description = "Authentifie l'utilisateur et retourne un JWT valable 24h"
    )
    @ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "Connexion réussie",
            content = @Content(schema = @Schema(implementation = AuthResponse.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "400",
            description = "Données invalides (email format, password trop court)"
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "401",
            description = "Email ou mot de passe incorrect"
        )
    })
    public ResponseEntity<ApiResponse<AuthResponse>> login(
        @Valid @RequestBody LoginRequest request
    ) {
        AuthResponse authResponse = authService.login(request);
        return ResponseEntity.ok(ApiResponse.success(authResponse, "Connexion réussie"));
    }

    /**
     * PUT /auth/password — Change le mot de passe de l'utilisateur authentifié.
     *
     * <p>Contrairement au reste de /auth/**, cette route exige une authentification
     * (voir SecurityConfig : règle explicite déclarée avant le permitAll de /auth/**).
     */
    @PutMapping("/password")
    @Operation(
        summary = "Changement de mot de passe",
        description = "Change le mot de passe de l'utilisateur authentifié (mot de passe actuel requis)",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    @ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "Mot de passe changé avec succès"
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "400",
            description = "Données invalides (nouveau mot de passe trop court)"
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "401",
            description = "Non authentifié, ou mot de passe actuel incorrect"
        )
    })
    public ResponseEntity<ApiResponse<Void>> changePassword(
        Authentication authentication,
        @Valid @RequestBody ChangePasswordRequest request
    ) {
        authService.changePassword(authentication.getName(), request);
        return ResponseEntity.ok(ApiResponse.success("Mot de passe changé avec succès"));
    }
}
