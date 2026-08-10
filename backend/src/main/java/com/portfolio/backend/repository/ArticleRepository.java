package com.portfolio.backend.repository;

import com.portfolio.backend.entity.Article;
import com.portfolio.backend.entity.ArticleStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ArticleRepository extends JpaRepository<Article, Long> {

    Page<Article> findByStatusOrderByPublishedAtDesc(ArticleStatus status, Pageable pageable);

    Page<Article> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Optional<Article> findBySlugAndStatus(String slug, ArticleStatus status);

    boolean existsBySlug(String slug);

    @Query(
        "SELECT DISTINCT a FROM Article a JOIN a.tags t "
            + "WHERE a.status = :status AND t = :tag ORDER BY a.publishedAt DESC"
    )
    Page<Article> findByStatusAndTag(
        @Param("status") ArticleStatus status,
        @Param("tag") String tag,
        Pageable pageable
    );
}
