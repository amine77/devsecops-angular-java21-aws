package com.portfolio.backend.entity;

/**
 * Rôles disponibles dans l'application.
 *
 * <p>Raison d'utiliser une enum plutôt qu'une String :
 * - Typage fort : impossible de mettre une valeur invalide
 * - Refactoring sûr : l'IDE détecte toutes les utilisations
 * - Stocké en DB comme VARCHAR via @Enumerated(EnumType.STRING)
 */
public enum Role {
    /**
     * Utilisateur standard : peut voir le portfolio.
     */
    USER,

    /**
     * Administrateur : peut créer/modifier/supprimer des projets.
     */
    ADMIN
}
