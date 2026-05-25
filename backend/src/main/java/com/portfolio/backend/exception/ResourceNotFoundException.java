package com.portfolio.backend.exception;

/**
 * Exception levée quand une ressource demandée n'existe pas en DB.
 *
 * <p>Raison d'une exception métier dédiée :
 * - Sémantique claire : ResourceNotFoundException → 404 Not Found
 * - Le GlobalExceptionHandler intercepte et renvoie le bon code HTTP
 * - On n'utilise pas directement ResponseStatusException dans les services
 *   car cela crée un couplage HTTP dans la couche métier (violation SOLID)
 *
 * <p>Extends RuntimeException (unchecked) :
 * - Pas besoin de la déclarer dans les signatures de méthodes
 * - Spring Transactions gère automatiquement le rollback
 */
public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException(String message) {
        super(message);
    }

    public ResourceNotFoundException(String resourceName, String fieldName, Object fieldValue) {
        super(String.format("%s introuvable avec %s : %s", resourceName, fieldName, fieldValue));
    }
}
