package com.portfolio.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 * Entité JPA représentant un utilisateur.
 *
 * <p>Implémente {@link UserDetails} pour l'intégration avec Spring Security.
 * Raison : Spring Security peut charger directement cet objet via UserDetailsService
 * sans avoir besoin d'un adapter supplémentaire.
 *
 * <p>Choix Lombok :
 * - @Getter/@Setter : évite le boilerplate des getters/setters
 * - @Builder : pattern builder pour la création fluide (ex: User.builder().email("x").build())
 * - @NoArgsConstructor : requis par JPA (réflexion)
 * - @AllArgsConstructor : requis par @Builder
 *
 * <p>⚠️ On N'utilise PAS @Data avec JPA :
 * - @Data génère equals/hashCode basés sur TOUS les champs
 * - Avec JPA, equals/hashCode doit être basé sur l'ID uniquement
 * - @Data avec @Entity → problèmes de performance et de cycles infinis
 */
@Entity
@Table(name = "users")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User implements UserDetails {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(name = "first_name", nullable = false, length = 100)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 100)
    private String lastName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    @Builder.Default
    private Role role = Role.USER;

    @Column(nullable = false)
    @Builder.Default
    private boolean enabled = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();

    /**
     * Relation bidirectionnelle vers les projets.
     * mappedBy = "user" : la table de jointure est gérée côté Project.
     * CascadeType.ALL : si l'user est supprimé, ses projets le sont aussi (cf. SQL ON DELETE CASCADE).
     */
    @OneToMany(mappedBy = "user")
    @Builder.Default
    private List<Project> projects = new ArrayList<>();

    // =========================================================================
    // UserDetails interface — intégration Spring Security
    // =========================================================================

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    @Override
    public String getUsername() {
        return email; // On utilise l'email comme username
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    // =========================================================================
    // equals/hashCode basés sur l'ID uniquement (bonne pratique JPA)
    // =========================================================================

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof User other)) {
            return false;
        }
        return id != null && id.equals(other.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
