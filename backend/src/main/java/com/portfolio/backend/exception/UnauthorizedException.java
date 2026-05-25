package com.portfolio.backend.exception;

/**
 * Exception levée lors d'un accès non autorisé (401 Unauthorized).
 *
 * <p>Cas d'usage :
 * - Token JWT invalide ou expiré
 * - Tentative de login avec mauvais mot de passe
 * - Accès à une ressource appartenant à un autre utilisateur
 */
public class UnauthorizedException extends RuntimeException {

    public UnauthorizedException(String message) {
        super(message);
    }
}
