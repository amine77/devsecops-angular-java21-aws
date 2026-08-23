package com.portfolio.backend.dto.response;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record ExperienceResponse(
    Long id,
    String entreprise,
    String poste,
    String contexte,
    LocalDate dateDebut,
    LocalDate dateFin,
    boolean current,
    String description,
    List<String> realisations,
    List<String> stack,
    int ordreAffichage,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
}
