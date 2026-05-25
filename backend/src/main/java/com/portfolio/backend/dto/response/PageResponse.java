package com.portfolio.backend.dto.response;

import org.springframework.data.domain.Page;

import java.util.List;

/**
 * Wrapper de pagination pour les endpoints de liste.
 *
 * <p>Raison : standardiser la pagination dans toutes les réponses de liste.
 * Le frontend peut ainsi utiliser les mêmes champs pour toutes les pages.
 *
 * <p>Exemple de réponse JSON :
 * <pre>
 * {
 *   "content": [...],
 *   "page": 0,
 *   "size": 10,
 *   "totalElements": 42,
 *   "totalPages": 5,
 *   "first": true,
 *   "last": false
 * }
 * </pre>
 *
 * @param <T> type des éléments de la liste
 */
public record PageResponse<T>(
    List<T> content,
    int page,
    int size,
    long totalElements,
    int totalPages,
    boolean first,
    boolean last
) {

    /**
     * Crée un PageResponse depuis un Page Spring Data.
     *
     * @param springPage le Page retourné par le repository
     * @param <T> type des éléments
     * @return le PageResponse correspondant
     */
    public static <T> PageResponse<T> from(Page<T> springPage) {
        return new PageResponse<>(
            springPage.getContent(),
            springPage.getNumber(),
            springPage.getSize(),
            springPage.getTotalElements(),
            springPage.getTotalPages(),
            springPage.isFirst(),
            springPage.isLast()
        );
    }
}
