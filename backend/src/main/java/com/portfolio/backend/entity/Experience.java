package com.portfolio.backend.entity;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "experiences")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Experience {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String entreprise;

    @Column(nullable = false, length = 200)
    private String poste;

    @Column(length = 500)
    private String contexte;

    @Column(name = "date_debut", nullable = false)
    private LocalDate dateDebut;

    /** null = poste actuel (mission en cours). */
    @Column(name = "date_fin")
    private LocalDate dateFin;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @ElementCollection
    @CollectionTable(name = "experience_realisations", joinColumns = @JoinColumn(name = "experience_id"))
    @OrderColumn(name = "position")
    @Column(name = "realisation", columnDefinition = "TEXT")
    @Builder.Default
    private List<String> realisations = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "experience_stack", joinColumns = @JoinColumn(name = "experience_id"))
    @OrderColumn(name = "position")
    @Column(name = "techno", length = 100)
    @Builder.Default
    private List<String> stack = new ArrayList<>();

    @Column(name = "ordre_affichage", nullable = false)
    @Builder.Default
    private int ordreAffichage = 0;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

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
        if (!(o instanceof Experience other)) {
            return false;
        }
        return id != null && id.equals(other.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
