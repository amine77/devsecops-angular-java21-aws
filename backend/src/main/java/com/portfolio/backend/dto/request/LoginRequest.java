 package com.portfolio.backend.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * DTO de requête pour le login.
 *
 * <p>Annotations Bean Validation :
 * - @NotBlank : la valeur ne doit pas être null, vide ou contenir seulement des espaces
 * - @Email : valide le format email (RFC 5322)
 * - @Size : contrainte de longueur
 *
 * <p>Ces validations sont vérifiées AUTOMATIQUEMENT par Spring
 * lorsque le paramètre du controller est annoté @Valid.
 * En cas d'erreur → MethodArgumentNotValidException → GlobalExceptionHandler → 400 Bad Request.
 */
public record LoginRequest(

    @NotBlank(message = "L'email est obligatoire")
    @Email(message = "Format d'email invalide")
    String email,

    @NotBlank(message = "Le mot de passe est obligatoire")
    @Size(min = 6, max = 100, message = "Le mot de passe doit contenir entre 6 et 100 caractères")
    String password

) { }
