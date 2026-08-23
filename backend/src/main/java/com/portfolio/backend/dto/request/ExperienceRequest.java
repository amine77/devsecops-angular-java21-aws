package com.portfolio.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

/**
 * DTO de requête pour créer ou mettre à jour une expérience professionnelle.
 *
 * <p>dateFin est nullable : null signifie que la mission est en cours.
 */
public record ExperienceRequest(

    @NotBlank(message = "L'entreprise est obligatoire")
    @Size(min = 2, max = 200, message = "L'entreprise doit contenir entre 2 et 200 caractères")
    String entreprise,

    @NotBlank(message = "Le poste est obligatoire")
    @Size(min = 2, max = 200, message = "Le poste doit contenir entre 2 et 200 caractères")
    String poste,

    @Size(max = 500, message = "Le contexte ne peut pas dépasser 500 caractères")
    String contexte,

    @NotNull(message = "La date de début est obligatoire")
    LocalDate dateDebut,

    LocalDate dateFin,

    @NotBlank(message = "La description est obligatoire")
    String description,

    List<String> realisations,

    List<String> stack,

    int ordreAffichage

) { }
