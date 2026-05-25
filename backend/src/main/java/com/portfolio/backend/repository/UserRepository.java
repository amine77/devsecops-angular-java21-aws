package com.portfolio.backend.repository;

import com.portfolio.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository JPA pour les utilisateurs.
 *
 * <p>Extends JpaRepository<User, Long> :
 * - Spring Data génère automatiquement les implémentations SQL
 * - Long = type de la clé primaire
 * - Hérite de : save(), findById(), findAll(), delete(), count(), etc.
 *
 * <p>Méthodes dérivées (Spring Data Query by Method Name) :
 * - findByEmail → Spring génère : SELECT * FROM users WHERE email = ?
 * - existsByEmail → Spring génère : SELECT COUNT(*) > 0 FROM users WHERE email = ?
 * Raison : pas de SQL manuel pour des requêtes simples = moins d'erreurs.
 */
@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    /**
     * Recherche un utilisateur par son email.
     * Utilisé par Spring Security pour l'authentification.
     */
    Optional<User> findByEmail(String email);

    /**
     * Vérifie si un email est déjà utilisé.
     * Utilisé lors de l'inscription pour éviter les doublons.
     */
    boolean existsByEmail(String email);
}
