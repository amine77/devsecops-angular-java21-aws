package com.portfolio.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;

import java.time.LocalDateTime;

/**
 * Wrapper standard pour TOUTES les réponses API.
 *
 * <p>Raison d'un wrapper standard :
 * - Cohérence : le frontend sait toujours à quoi s'attendre
 * - Metadata : timestamp, version API, pagination dans un format uniforme
 * - Évolution : on peut ajouter des champs sans casser les clients
 *
 * <p>Utilisation d'un Java Record (Java 21) :
 * - Immuable par nature
 * - equals/hashCode/toString générés automatiquement
 * - Plus concis que les classes POJO
 *
 * <p>@JsonInclude(NON_NULL) : les champs null ne sont pas sérialisés en JSON.
 * Raison : économise la bande passante, API plus propre.
 *
 * <p>Exemples de réponses :
 * <pre>
 * // Succès simple
 * ApiResponse.success("Projet créé")
 * → { "success": true, "message": "Projet créé", "timestamp": "..." }
 *
 * // Succès avec données
 * ApiResponse.success(projectResponse)
 * → { "success": true, "data": {...}, "timestamp": "..." }
 *
 * // Erreur
 * ApiResponse.error("Not found")
 * → { "success": false, "message": "Not found", "timestamp": "..." }
 * </pre>
 *
 * @param <T> type de la donnée retournée (ProjectResponse, List<ProjectResponse>, etc.)
 */
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiResponse<T>(
    boolean success,
    String message,
    T data,
    LocalDateTime timestamp
) {

    /** Factory method : réponse succès avec données. */
    public static <T> ApiResponse<T> success(T data) {
        return ApiResponse.<T>builder()
            .success(true)
            .data(data)
            .timestamp(LocalDateTime.now())
            .build();
    }

    /** Factory method : réponse succès avec message uniquement. */
    public static <T> ApiResponse<T> success(String message) {
        return ApiResponse.<T>builder()
            .success(true)
            .message(message)
            .timestamp(LocalDateTime.now())
            .build();
    }

    /** Factory method : réponse succès avec données et message. */
    public static <T> ApiResponse<T> success(T data, String message) {
        return ApiResponse.<T>builder()
            .success(true)
            .data(data)
            .message(message)
            .timestamp(LocalDateTime.now())
            .build();
    }

    /** Factory method : réponse erreur. */
    public static <T> ApiResponse<T> error(String message) {
        return ApiResponse.<T>builder()
            .success(false)
            .message(message)
            .timestamp(LocalDateTime.now())
            .build();
    }
}
