package com.portfolio.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.hibernate.validator.constraints.URL;

import java.util.List;

/**
 * DTO de requête pour créer ou mettre à jour un projet.
 *
 * <p>Contient uniquement les champs modifiables par l'utilisateur.
 * Les champs système (id, createdAt, userId) ne sont pas dans le DTO
 * car ils ne doivent pas être envoyés par le client.
 */
public record ProjectRequest(

    @NotBlank(message = "Le titre est obligatoire")
    @Size(min = 2, max = 200, message = "Le titre doit contenir entre 2 et 200 caractères")
    String title,

    @NotBlank(message = "La description est obligatoire")
    @Size(min = 10, max = 5000, message = "La description doit contenir entre 10 et 5000 caractères")
    String description,

    @Size(max = 500, message = "Le résumé ne peut pas dépasser 500 caractères")
    String summary,

    @URL(message = "L'URL GitHub doit être une URL valide")
    String githubUrl,

    @URL(message = "L'URL de démo doit être une URL valide")
    String demoUrl,

    @URL(message = "L'URL de l'image doit être une URL valide")
    String imageUrl,

    boolean featured,

    Integer sortOrder,

    List<Long> skillIds

) { }
