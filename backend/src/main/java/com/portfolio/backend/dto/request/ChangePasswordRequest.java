package com.portfolio.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * DTO de requête pour le changement de mot de passe de l'utilisateur authentifié.
 *
 * <p>Le mot de passe actuel est exigé même si l'appelant possède déjà un JWT valide :
 * un JWT volé (XSS, log leak) ne doit pas suffire à lui seul pour prendre le contrôle
 * définitif du compte en changeant son mot de passe.
 */
public record ChangePasswordRequest(

    @NotBlank(message = "Le mot de passe actuel est obligatoire")
    String currentPassword,

    @NotBlank(message = "Le nouveau mot de passe est obligatoire")
    @Size(min = 12, max = 100, message = "Le nouveau mot de passe doit contenir entre 12 et 100 caractères")
    String newPassword

) { }
