package com.portfolio.backend.exception;

import com.portfolio.backend.dto.response.ErrorResponse;
import com.portfolio.backend.observability.AppMetrics;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

/**
 * Gestionnaire global des exceptions HTTP.
 *
 * <p>@RestControllerAdvice est la combinaison de :
 * - @ControllerAdvice : intercepte les exceptions de tous les controllers
 * - @ResponseBody : les réponses sont sérialisées en JSON automatiquement
 *
 * <p>Raison d'une gestion centralisée :
 * - Un seul endroit pour toute la logique d'erreur
 * - Format d'erreur cohérent dans toute l'API
 * - Les controllers restent propres (pas de try/catch partout)
 * - Facile à tester (une seule classe à tester pour les erreurs)
 *
 * <p>Ordre de priorité : l'exception la plus spécifique est attrapée en premier.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private final AppMetrics metrics;

    public GlobalExceptionHandler(AppMetrics metrics) {
        this.metrics = metrics;
    }



    /**
     * 404 Not Found — Ressource inexistante.
     */
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFound(
        ResourceNotFoundException ex,
        HttpServletRequest request
    ) {
        log.warn("Resource not found: {} - Path: {}", ex.getMessage(), request.getRequestURI());
        return ResponseEntity
            .status(HttpStatus.NOT_FOUND)
            .body(ErrorResponse.of(
                HttpStatus.NOT_FOUND.value(),
                "Not Found",
                ex.getMessage(),
                request.getRequestURI()
            ));
    }

    /**
     * 400 Bad Request — Validation Bean Validation échouée.
     * Levée par @Valid sur les DTOs de requête.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationErrors(
        MethodArgumentNotValidException ex,
        HttpServletRequest request
    ) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach(error -> {
            String fieldName = ((FieldError) error).getField();
            String errorMessage = error.getDefaultMessage();
            errors.put(fieldName, errorMessage);
        });

        log.warn("Validation failed for path: {} - Errors: {}", request.getRequestURI(), errors);

        return ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body(ErrorResponse.withValidation(
                HttpStatus.BAD_REQUEST.value(),
                "Bad Request",
                "Erreur de validation des données",
                request.getRequestURI(),
                errors
            ));
    }

    /**
     * 401 Unauthorized — Authentification invalide.
     * Incrémente le compteur Prometheus auth.login.failure.
     */
    @ExceptionHandler({UnauthorizedException.class, BadCredentialsException.class})
    public ResponseEntity<ErrorResponse> handleUnauthorized(
        RuntimeException ex,
        HttpServletRequest request
    ) {
        // requestId déjà dans le MDC → inclus automatiquement dans les logs JSON/dev
        log.warn("Unauthorized access attempt: method={} path={}",
            request.getMethod(), request.getRequestURI());
        metrics.incrementLoginFailure();
        metrics.incrementHttpError(HttpStatus.UNAUTHORIZED.value(), request.getRequestURI());
        return ResponseEntity
            .status(HttpStatus.UNAUTHORIZED)
            .body(ErrorResponse.of(
                HttpStatus.UNAUTHORIZED.value(),
                "Unauthorized",
                "Authentification invalide ou token expiré",
                request.getRequestURI()
            ));
    }

    /**
     * 403 Forbidden — Accès refusé (authentifié mais pas les droits).
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(
        AccessDeniedException ex,
        HttpServletRequest request
    ) {
        log.warn("Access denied at: {} - {}", request.getRequestURI(), ex.getMessage());
        return ResponseEntity
            .status(HttpStatus.FORBIDDEN)
            .body(ErrorResponse.of(
                HttpStatus.FORBIDDEN.value(),
                "Forbidden",
                "Vous n'avez pas les droits pour accéder à cette ressource",
                request.getRequestURI()
            ));
    }

    /**
     * 400 Bad Request — Argument illégal.
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(
        IllegalArgumentException ex,
        HttpServletRequest request
    ) {
        log.warn("Illegal argument at: {} - {}", request.getRequestURI(), ex.getMessage());
        return ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body(ErrorResponse.of(
                HttpStatus.BAD_REQUEST.value(),
                "Bad Request",
                ex.getMessage(),
                request.getRequestURI()
            ));
    }

    /**
     * 500 Internal Server Error — Toute exception non gérée.
     * Raison du catch-all : éviter de leaker des stack traces en prod.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGenericException(
        Exception ex,
        HttpServletRequest request
    ) {
        // Log complet avec stack trace en ERROR (important pour le monitoring)
        log.error("Unexpected error at: {} - {}", request.getRequestURI(), ex.getMessage(), ex);
        return ResponseEntity
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(ErrorResponse.of(
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                "Internal Server Error",
                "Une erreur interne s'est produite. Veuillez réessayer.",
                request.getRequestURI()
            ));
    }
}
