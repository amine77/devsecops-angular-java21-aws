package com.portfolio.backend.repository;

import com.portfolio.backend.entity.Project;
import com.portfolio.backend.entity.ProjectStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository JPA pour les projets.
 *
 * <p>Utilise la pagination Spring Data (Pageable) pour les endpoints de liste.
 * Raison : retourner TOUS les projets d'un coup = problème de performance
 * et de charge réseau si la liste est grande.
 */
@Repository
public interface ProjectRepository extends JpaRepository<Project, Long> {

    /**
     * Recherche paginée par statut, triée par sort_order.
     * Utilisé par l'endpoint public GET /projects
     */
    Page<Project> findByStatusOrderBySortOrderAsc(ProjectStatus status, Pageable pageable);

    /**
     * Projets mis en avant (featured = true), triés par ordre.
     * Utilisé pour la homepage du portfolio.
     */
    List<Project> findByFeaturedTrueAndStatusOrderBySortOrderAsc(ProjectStatus status);

    /**
     * Requête JPQL avec fetch join pour éviter le problème N+1.
     *
     * <p>Problème N+1 : si on charge 10 projets puis accède à project.getSkills()
     * pour chacun, Hibernate exécute 10 requêtes supplémentaires = 11 requêtes totales.
     *
     * <p>Solution : JOIN FETCH charge les skills en une seule requête.
     * Raison : optimisation de performance essentielle.
     */
    @Query("SELECT DISTINCT p FROM Project p LEFT JOIN FETCH p.skills WHERE p.status = :status")
    List<Project> findAllActiveWithSkills(ProjectStatus status);
}
