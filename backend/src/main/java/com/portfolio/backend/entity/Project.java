package com.portfolio.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Entité JPA représentant un projet du portfolio.
 *
 * <p>Relations :
 * - ManyToOne vers User : un projet appartient à un utilisateur
 * - ManyToMany vers Skill : un projet utilise plusieurs compétences
 *
 * <p>Fetch Strategy :
 * - ManyToOne User : LAZY (on ne charge pas l'user à chaque fois)
 * - ManyToMany Skills : LAZY (on charge les skills seulement si besoin)
 * Raison : EAGER loading = N+1 queries = problème de performance classique
 */
@Entity
@Table(name = "projects")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Project {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(length = 500)
    private String summary;

    @Column(name = "github_url", length = 500)
    private String githubUrl;

    @Column(name = "demo_url", length = 500)
    private String demoUrl;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    @Builder.Default
    private ProjectStatus status = ProjectStatus.ACTIVE;

    @Column(nullable = false)
    @Builder.Default
    private boolean featured = false;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;

    /**
     * Relation ManyToOne vers User.
     * FetchType.LAZY : l'user n'est chargé que si on accède à project.getUser()
     * @JoinColumn : spécifie la colonne FK dans la table projects
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /**
     * Relation ManyToMany avec Skill.
     * La table de jointure project_skills est définie ici.
     * FetchType.LAZY : les skills sont chargés uniquement si nécessaire.
     */
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "project_skills",
        joinColumns = @JoinColumn(name = "project_id"),
        inverseJoinColumns = @JoinColumn(name = "skill_id")
    )
    @Builder.Default
    private List<Skill> skills = new ArrayList<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Project other)) {
            return false;
        }
        return id != null && id.equals(other.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
