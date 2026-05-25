package com.portfolio.backend.dto.response;

/**
 * Réponse d'authentification retournée après un login réussi.
 *
 * <p>Contient le JWT et les infos utilisateur de base.
 * Raison de ne PAS retourner l'entité User directement :
 * - Évite d'exposer le hash du mot de passe
 * - Évite les cycles de sérialisation (User → Projects → User...)
 * - Contrôle précis de ce qui est exposé côté API
 */
public record AuthResponse(
    String token,
    String tokenType,
    long expiresIn,
    UserInfo user
) {

    public static AuthResponse of(String token, long expiresIn, UserInfo user) {
        return new AuthResponse(token, "Bearer", expiresIn, user);
    }

    /**
     * Informations de l'utilisateur exposées dans la réponse auth.
     * Record imbriqué : concis, immuable, lisible.
     */
    public record UserInfo(
        Long id,
        String email,
        String firstName,
        String lastName,
        String role
    ) { }
}
