package com.portfolio.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * DTO de réponse pour les erreurs HTTP.
 *
 * <p>Format standard des erreurs :
 * <pre>
 * {
 *   "timestamp": "2026-01-01T10:00:00",
 *   "status": 404,
 *   "error": "Not Found",
 *   "message": "Projet introuvable avec l'ID : 42",
 *   "path": "/api/projects/42",
 *   "validationErrors": {
 *     "title": "Le titre est obligatoire",
 *     "githubUrl": "URL invalide"
 *   }
 * }
 * </pre>
 *
 * <p>@JsonInclude(NON_NULL) : validationErrors n'apparaît que pour les erreurs 400.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(
    LocalDateTime timestamp,
    int status,
    String error,
    String message,
    String path,
    Map<String, String> validationErrors
) {

    public static ErrorResponse of(int status, String error, String message, String path) {
        return new ErrorResponse(LocalDateTime.now(), status, error, message, path, null);
    }

    public static ErrorResponse withValidation(
        int status,
        String error,
        String message,
        String path,
        Map<String, String> validationErrors
    ) {
        return new ErrorResponse(LocalDateTime.now(), status, error, message, path, validationErrors);
    }
}
