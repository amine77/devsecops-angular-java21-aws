# Blog "Articles" — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une section "Blog" complète (backend + frontend + admin) permettant de publier des articles techniques en Markdown, en suivant exactement les patterns déjà établis pour `Project`/`Skill`.

**Architecture:** Backend Spring Boot classique en couches (entité → repository → service → mapper/DTO → controller), sécurisé par le système JWT/`ROLE_ADMIN` existant. Frontend Angular standalone avec Signals/OnPush : feature publique `features/portfolio/blog/`, formulaire admin `features/admin/article-form/`, extension de `dashboard.component.ts`. Le rendu Markdown→HTML se fait uniquement côté frontend (`marked` + `DOMPurify`), le backend ne stocke/renvoie que du Markdown brut.

**Tech Stack:** Java 21, Spring Boot 3.5.3, Spring Data JPA, Flyway, PostgreSQL — Angular 21.2.17 standalone/Signals/OnPush, Angular Material 21.2.14, Jest 30.4.2, `marked` + `dompurify` (nouvelles dépendances).

## Global Constraints

- Spec source de vérité : `docs/superpowers/specs/2026-08-09-blog-articles-design.md`. Toute décision de ce plan qui en diverge doit être justifiée explicitement dans la tâche concernée.
- Backend : aucun moteur Markdown côté Java — l'entité `Article` stocke du Markdown brut dans `content` (colonne `TEXT`).
- Backend : réutiliser l'auth JWT + `ROLE_ADMIN` existants (`@PreAuthorize("hasRole('ADMIN')")`, `SecurityConfig`) — aucun nouveau mécanisme d'authentification.
- Backend : suivre le style Lombok de `Project` (`@Getter/@Setter/@Builder/@NoArgsConstructor/@AllArgsConstructor`, `equals`/`hashCode` sur `id` uniquement via `getClass().hashCode()`).
- Backend : mapper manuel (pas de MapStruct), comme `ProjectMapper`.
- Backend : slug généré automatiquement depuis le titre (normalisation accents/espaces), suffixe `-2`, `-3`... en cas de collision ; le slug est immuable après création.
- Backend : `publishedAt` est rempli uniquement au premier passage à `PUBLISHED` (jamais réinitialisé ensuite).
- Backend : `DELETE /articles/{id}` est une suppression définitive (hard delete) — pas de soft-archive comme pour `Project`.
- Frontend : nouvelles dépendances `marked` + `dompurify` (+ `@types/dompurify`) — rendu HTML fait uniquement côté client, sanitizé avant tout `[innerHTML]`.
- Frontend : suivre les conventions Signals/OnPush/`inject()` déjà en place (`ProjectService`, `ProjectListComponent`, etc.).
- **Convention de test héritée du code base** : les couches sans logique métier propre (entité JPA, migration SQL, repository Spring Data, mapper manuel, DTOs records, modèles TypeScript) n'ont **aucun test dédié** dans ce projet — vérifié par l'absence totale de fichiers `*RepositoryTest`/`*MapperTest` dans `backend/src/test/java/com/portfolio/backend/**`. Ces tâches sont vérifiées par compilation (`mvn compile -q` / `npx tsc -p tsconfig.app.json --noEmit`) plutôt que par un cycle TDD test-first. Le TDD strict (test → échec → implémentation → succès) s'applique à toute la logique métier : `ArticleService`, `ArticleController`, et les composants Angular avec logique (services, composants avec état/comportement).
- Toutes les nouvelles chaînes utilisateur passent par le système i18n (`TranslatePipe` / `LanguageService.translate()`), pas de texte français en dur dans les nouveaux composants.

---

## Backend

### Task B1 : Migration SQL + entité `Article` + enum `ArticleStatus`

**Files:**
- Create: `backend/src/main/resources/db/migration/V10__create_articles.sql`
- Create: `backend/src/main/java/com/portfolio/backend/entity/ArticleStatus.java`
- Create: `backend/src/main/java/com/portfolio/backend/entity/Article.java`

**Interfaces:**
- Consumes: `com.portfolio.backend.entity.User` (existant, `@ManyToOne(LAZY)`)
- Produces: `Article` (champs : `id: Long`, `title: String`, `slug: String`, `summary: String`, `content: String`, `coverImageUrl: String`, `tags: List<String>`, `status: ArticleStatus`, `publishedAt: LocalDateTime`, `user: User`, `createdAt: LocalDateTime`, `updatedAt: LocalDateTime`) et `ArticleStatus` (`DRAFT`, `PUBLISHED`) — consommés par B2/B3/B4.

- [ ] **Step 1 : Créer la migration Flyway**

Fichier `backend/src/main/resources/db/migration/V10__create_articles.sql` :

```sql
CREATE TABLE articles (
    id               BIGSERIAL     PRIMARY KEY,
    title            VARCHAR(200)  NOT NULL,
    slug             VARCHAR(255)  NOT NULL,
    summary          VARCHAR(500),
    content          TEXT          NOT NULL,
    cover_image_url  VARCHAR(500),
    status           VARCHAR(50)   NOT NULL DEFAULT 'DRAFT',
    published_at     TIMESTAMP,
    user_id          BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at       TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_articles_slug UNIQUE (slug)
);

CREATE TABLE article_tags (
    article_id BIGINT       NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    tag        VARCHAR(50)  NOT NULL
);

CREATE INDEX idx_articles_status       ON articles(status);
CREATE INDEX idx_articles_published_at ON articles(published_at);
CREATE INDEX idx_article_tags_tag      ON article_tags(tag);
```

- [ ] **Step 2 : Créer l'enum `ArticleStatus`**

Fichier `backend/src/main/java/com/portfolio/backend/entity/ArticleStatus.java` :

```java
package com.portfolio.backend.entity;

public enum ArticleStatus {
    DRAFT,
    PUBLISHED
}
```

- [ ] **Step 3 : Créer l'entité `Article`**

Fichier `backend/src/main/java/com/portfolio/backend/entity/Article.java` :

```java
package com.portfolio.backend.entity;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
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

@Entity
@Table(name = "articles")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Article {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, length = 255, unique = true)
    private String slug;

    @Column(length = 500)
    private String summary;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "cover_image_url", length = 500)
    private String coverImageUrl;

    @ElementCollection
    @CollectionTable(name = "article_tags", joinColumns = @JoinColumn(name = "article_id"))
    @Column(name = "tag", length = 50)
    @Builder.Default
    private List<String> tags = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    @Builder.Default
    private ArticleStatus status = ArticleStatus.DRAFT;

    @Column(name = "published_at")
    private LocalDateTime publishedAt;

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
        if (!(o instanceof Article other)) {
            return false;
        }
        return id != null && id.equals(other.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
```

- [ ] **Step 4 : Vérifier la compilation**

Run: `mvn compile -q` (depuis `backend/`)
Expected: build réussi, aucune erreur de compilation.

- [ ] **Step 5 : Commit**

```bash
git add backend/src/main/resources/db/migration/V10__create_articles.sql backend/src/main/java/com/portfolio/backend/entity/ArticleStatus.java backend/src/main/java/com/portfolio/backend/entity/Article.java
git commit -m "feat(backend): ajoute la migration et l'entité Article"
```

---

### Task B2 : Repository / Mapper / DTOs `Article`

**Files:**
- Create: `backend/src/main/java/com/portfolio/backend/repository/ArticleRepository.java`
- Create: `backend/src/main/java/com/portfolio/backend/dto/request/ArticleRequest.java`
- Create: `backend/src/main/java/com/portfolio/backend/dto/response/ArticleResponse.java`
- Create: `backend/src/main/java/com/portfolio/backend/mapper/ArticleMapper.java`

**Interfaces:**
- Consumes: `Article`, `ArticleStatus` (Task B1) ; `ApiResponse<T>`/`PageResponse<T>` (existants, non modifiés).
- Produces:
  - `ArticleRepository` : `findByStatusOrderByPublishedAtDesc(ArticleStatus, Pageable): Page<Article>`, `findAllByOrderByCreatedAtDesc(Pageable): Page<Article>`, `findBySlugAndStatus(String, ArticleStatus): Optional<Article>`, `existsBySlug(String): boolean`, `findByStatusAndTag(ArticleStatus, String, Pageable): Page<Article>`.
  - `ArticleRequest(String title, String summary, String content, String coverImageUrl, List<String> tags, ArticleStatus status)`.
  - `ArticleResponse(Long id, String title, String slug, String summary, String content, String coverImageUrl, List<String> tags, ArticleStatus status, LocalDateTime publishedAt, String authorName, LocalDateTime createdAt, LocalDateTime updatedAt)`.
  - `ArticleMapper.toResponse(Article): ArticleResponse`, `ArticleMapper.toResponseList(List<Article>): List<ArticleResponse>` — consommés par B3/B4.

- [ ] **Step 1 : Créer `ArticleRepository`**

Fichier `backend/src/main/java/com/portfolio/backend/repository/ArticleRepository.java` :

```java
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
```

- [ ] **Step 2 : Créer `ArticleRequest`**

Fichier `backend/src/main/java/com/portfolio/backend/dto/request/ArticleRequest.java` :

```java
package com.portfolio.backend.dto.request;

import com.portfolio.backend.entity.ArticleStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.validator.constraints.URL;

import java.util.List;

public record ArticleRequest(
    @NotBlank(message = "Le titre est obligatoire")
    @Size(min = 2, max = 200, message = "Le titre doit contenir entre 2 et 200 caractères")
    String title,

    @Size(max = 500, message = "Le résumé ne peut pas dépasser 500 caractères")
    String summary,

    @NotBlank(message = "Le contenu est obligatoire")
    String content,

    @URL(message = "L'URL doit commencer par http:// ou https://")
    String coverImageUrl,

    List<String> tags,

    @NotNull(message = "Le statut est obligatoire")
    ArticleStatus status
) {
}
```

- [ ] **Step 3 : Créer `ArticleResponse`**

Fichier `backend/src/main/java/com/portfolio/backend/dto/response/ArticleResponse.java` :

```java
package com.portfolio.backend.dto.response;

import com.portfolio.backend.entity.ArticleStatus;

import java.time.LocalDateTime;
import java.util.List;

public record ArticleResponse(
    Long id,
    String title,
    String slug,
    String summary,
    String content,
    String coverImageUrl,
    List<String> tags,
    ArticleStatus status,
    LocalDateTime publishedAt,
    String authorName,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
}
```

- [ ] **Step 4 : Créer `ArticleMapper`**

Fichier `backend/src/main/java/com/portfolio/backend/mapper/ArticleMapper.java` :

```java
package com.portfolio.backend.mapper;

import com.portfolio.backend.dto.response.ArticleResponse;
import com.portfolio.backend.entity.Article;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class ArticleMapper {

    public ArticleResponse toResponse(Article article) {
        return new ArticleResponse(
            article.getId(),
            article.getTitle(),
            article.getSlug(),
            article.getSummary(),
            article.getContent(),
            article.getCoverImageUrl(),
            article.getTags(),
            article.getStatus(),
            article.getPublishedAt(),
            article.getUser().getFirstName() + " " + article.getUser().getLastName(),
            article.getCreatedAt(),
            article.getUpdatedAt()
        );
    }

    public List<ArticleResponse> toResponseList(List<Article> articles) {
        return articles.stream().map(this::toResponse).toList();
    }
}
```

- [ ] **Step 5 : Vérifier la compilation**

Run: `mvn compile -q` (depuis `backend/`)
Expected: build réussi, aucune erreur de compilation.

- [ ] **Step 6 : Commit**

```bash
git add backend/src/main/java/com/portfolio/backend/repository/ArticleRepository.java backend/src/main/java/com/portfolio/backend/dto/request/ArticleRequest.java backend/src/main/java/com/portfolio/backend/dto/response/ArticleResponse.java backend/src/main/java/com/portfolio/backend/mapper/ArticleMapper.java
git commit -m "feat(backend): ajoute repository, DTOs et mapper Article"
```

---

### Task B3 : `ArticleService` (TDD)

**Files:**
- Create: `backend/src/main/java/com/portfolio/backend/service/ArticleService.java`
- Test: `backend/src/test/java/com/portfolio/backend/service/ArticleServiceTest.java`

**Interfaces:**
- Consumes: `ArticleRepository`, `ArticleMapper`, `ArticleRequest`, `ArticleResponse` (Task B2) ; `ResourceNotFoundException(String resourceName, String fieldName, Object fieldValue)` (existant) ; `PageResponse.from(Page<T>)` (existant) ; `User` (existant, via `SecurityContextHolder`).
- Produces: `ArticleService.getPublished(Pageable, String tag): PageResponse<ArticleResponse>`, `getPublishedBySlug(String): ArticleResponse`, `getAllForAdmin(Pageable): PageResponse<ArticleResponse>`, `getByIdForAdmin(Long): ArticleResponse`, `createArticle(ArticleRequest): ArticleResponse`, `updateArticle(Long, ArticleRequest): ArticleResponse`, `deleteArticle(Long): void` — consommés par B4.

- [ ] **Step 1 : Écrire le test de génération de slug (échec attendu)**

Fichier `backend/src/test/java/com/portfolio/backend/service/ArticleServiceTest.java` :

```java
package com.portfolio.backend.service;

import com.portfolio.backend.dto.request.ArticleRequest;
import com.portfolio.backend.dto.response.ArticleResponse;
import com.portfolio.backend.entity.Article;
import com.portfolio.backend.entity.ArticleStatus;
import com.portfolio.backend.entity.User;
import com.portfolio.backend.exception.ResourceNotFoundException;
import com.portfolio.backend.mapper.ArticleMapper;
import com.portfolio.backend.repository.ArticleRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@DisplayName("ArticleService — Tests unitaires")
class ArticleServiceTest {

    @Mock
    private ArticleRepository articleRepository;

    @Mock
    private ArticleMapper articleMapper;

    @InjectMocks
    private ArticleService articleService;

    private Article testArticle;
    private ArticleResponse testArticleResponse;

    @BeforeEach
    void setUp() {
        User mockUser = User.builder()
            .id(1L)
            .email("admin@portfolio.dev")
            .firstName("Amine")
            .lastName("Charrad")
            .build();
        SecurityContext ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(new UsernamePasswordAuthenticationToken(mockUser, null, List.of()));
        SecurityContextHolder.setContext(ctx);

        testArticle = Article.builder()
            .id(1L)
            .title("Mon article")
            .slug("mon-article")
            .content("Contenu Markdown")
            .status(ArticleStatus.DRAFT)
            .build();

        testArticleResponse = new ArticleResponse(
            1L, "Mon article", "mon-article", null, "Contenu Markdown", null,
            List.of(), ArticleStatus.DRAFT, null, "Amine Charrad", null, null
        );
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Nested
    @DisplayName("createArticle() — génération de slug")
    class CreateArticleSlugTests {

        @Test
        @DisplayName("Génère un slug normalisé depuis le titre")
        void shouldGenerateSlugFromTitle() {
            ArticleRequest request = new ArticleRequest(
                "Découvrir Kubernetes & l'Auto-scaling", null, "Contenu", null, List.of(), ArticleStatus.DRAFT
            );
            given(articleRepository.existsBySlug("decouvrir-kubernetes-l-auto-scaling")).willReturn(false);
            given(articleRepository.save(any(Article.class))).willReturn(testArticle);
            given(articleMapper.toResponse(testArticle)).willReturn(testArticleResponse);

            articleService.createArticle(request);

            ArgumentCaptor<Article> captor = ArgumentCaptor.forClass(Article.class);
            verify(articleRepository).save(captor.capture());
            assertThat(captor.getValue().getSlug()).isEqualTo("decouvrir-kubernetes-l-auto-scaling");
        }

        @Test
        @DisplayName("Ajoute un suffixe -2 en cas de collision de slug")
        void shouldAppendSuffixOnSlugCollision() {
            ArticleRequest request = new ArticleRequest(
                "Mon article", null, "Contenu", null, List.of(), ArticleStatus.DRAFT
            );
            given(articleRepository.existsBySlug("mon-article")).willReturn(true);
            given(articleRepository.existsBySlug("mon-article-2")).willReturn(false);
            given(articleRepository.save(any(Article.class))).willReturn(testArticle);
            given(articleMapper.toResponse(testArticle)).willReturn(testArticleResponse);

            articleService.createArticle(request);

            ArgumentCaptor<Article> captor = ArgumentCaptor.forClass(Article.class);
            verify(articleRepository).save(captor.capture());
            assertThat(captor.getValue().getSlug()).isEqualTo("mon-article-2");
        }
    }

    @Nested
    @DisplayName("publishedAt — transition de statut")
    class PublishedAtTests {

        @Test
        @DisplayName("Fixe publishedAt à la création si le statut est PUBLISHED")
        void shouldSetPublishedAtWhenCreatedAsPublished() {
            ArticleRequest request = new ArticleRequest(
                "Article publié", null, "Contenu", null, List.of(), ArticleStatus.PUBLISHED
            );
            given(articleRepository.existsBySlug(any())).willReturn(false);
            given(articleRepository.save(any(Article.class))).willReturn(testArticle);
            given(articleMapper.toResponse(testArticle)).willReturn(testArticleResponse);

            articleService.createArticle(request);

            ArgumentCaptor<Article> captor = ArgumentCaptor.forClass(Article.class);
            verify(articleRepository).save(captor.capture());
            assertThat(captor.getValue().getPublishedAt()).isNotNull();
        }

        @Test
        @DisplayName("Ne fixe pas publishedAt à la création si le statut est DRAFT")
        void shouldNotSetPublishedAtWhenCreatedAsDraft() {
            ArticleRequest request = new ArticleRequest(
                "Brouillon", null, "Contenu", null, List.of(), ArticleStatus.DRAFT
            );
            given(articleRepository.existsBySlug(any())).willReturn(false);
            given(articleRepository.save(any(Article.class))).willReturn(testArticle);
            given(articleMapper.toResponse(testArticle)).willReturn(testArticleResponse);

            articleService.createArticle(request);

            ArgumentCaptor<Article> captor = ArgumentCaptor.forClass(Article.class);
            verify(articleRepository).save(captor.capture());
            assertThat(captor.getValue().getPublishedAt()).isNull();
        }

        @Test
        @DisplayName("Fixe publishedAt lors de la première transition DRAFT vers PUBLISHED")
        void shouldSetPublishedAtOnFirstPublishTransition() {
            testArticle.setStatus(ArticleStatus.DRAFT);
            testArticle.setPublishedAt(null);
            ArticleRequest request = new ArticleRequest(
                "Mon article", null, "Contenu modifié", null, List.of(), ArticleStatus.PUBLISHED
            );
            given(articleRepository.findById(1L)).willReturn(Optional.of(testArticle));
            given(articleRepository.save(any(Article.class))).willReturn(testArticle);
            given(articleMapper.toResponse(testArticle)).willReturn(testArticleResponse);

            articleService.updateArticle(1L, request);

            assertThat(testArticle.getPublishedAt()).isNotNull();
        }

        @Test
        @DisplayName("Ne modifie pas publishedAt si l'article était déjà publié")
        void shouldNotResetPublishedAtWhenAlreadyPublished() {
            LocalDateTime originalPublishedAt = LocalDateTime.of(2026, 1, 1, 10, 0);
            testArticle.setStatus(ArticleStatus.PUBLISHED);
            testArticle.setPublishedAt(originalPublishedAt);
            ArticleRequest request = new ArticleRequest(
                "Mon article modifié", null, "Contenu modifié", null, List.of(), ArticleStatus.PUBLISHED
            );
            given(articleRepository.findById(1L)).willReturn(Optional.of(testArticle));
            given(articleRepository.save(any(Article.class))).willReturn(testArticle);
            given(articleMapper.toResponse(testArticle)).willReturn(testArticleResponse);

            articleService.updateArticle(1L, request);

            assertThat(testArticle.getPublishedAt()).isEqualTo(originalPublishedAt);
        }
    }

    @Nested
    @DisplayName("getPublished() — filtrage par tag")
    class GetPublishedTests {

        @Test
        @DisplayName("Utilise la requête filtrée par tag quand un tag est fourni")
        void shouldFilterByTagWhenTagProvided() {
            Pageable pageable = PageRequest.of(0, 10);
            Page<Article> page = new PageImpl<>(List.of(testArticle));
            given(articleRepository.findByStatusAndTag(eq(ArticleStatus.PUBLISHED), eq("kubernetes"), any()))
                .willReturn(page);
            given(articleMapper.toResponse(testArticle)).willReturn(testArticleResponse);

            articleService.getPublished(pageable, "kubernetes");

            verify(articleRepository).findByStatusAndTag(ArticleStatus.PUBLISHED, "kubernetes", pageable);
            verify(articleRepository, never()).findByStatusOrderByPublishedAtDesc(any(), any());
        }

        @Test
        @DisplayName("Utilise la requête non filtrée quand aucun tag n'est fourni")
        void shouldUseUnfilteredQueryWhenTagIsNull() {
            Pageable pageable = PageRequest.of(0, 10);
            Page<Article> page = new PageImpl<>(List.of(testArticle));
            given(articleRepository.findByStatusOrderByPublishedAtDesc(ArticleStatus.PUBLISHED, pageable))
                .willReturn(page);
            given(articleMapper.toResponse(testArticle)).willReturn(testArticleResponse);

            articleService.getPublished(pageable, null);

            verify(articleRepository).findByStatusOrderByPublishedAtDesc(ArticleStatus.PUBLISHED, pageable);
            verify(articleRepository, never()).findByStatusAndTag(any(), any(), any());
        }
    }

    @Nested
    @DisplayName("getPublishedBySlug() — accès public")
    class GetPublishedBySlugTests {

        @Test
        @DisplayName("Retourne l'article publié quand le slug existe")
        void shouldReturnArticleWhenSlugExists() {
            given(articleRepository.findBySlugAndStatus("mon-article", ArticleStatus.PUBLISHED))
                .willReturn(Optional.of(testArticle));
            given(articleMapper.toResponse(testArticle)).willReturn(testArticleResponse);

            ArticleResponse result = articleService.getPublishedBySlug("mon-article");

            assertThat(result).isNotNull();
            assertThat(result.slug()).isEqualTo("mon-article");
        }

        @Test
        @DisplayName("Lance ResourceNotFoundException si le slug n'existe pas ou est en DRAFT")
        void shouldThrowNotFoundWhenSlugDoesNotExistOrIsDraft() {
            given(articleRepository.findBySlugAndStatus("inconnu", ArticleStatus.PUBLISHED))
                .willReturn(Optional.empty());

            assertThatThrownBy(() -> articleService.getPublishedBySlug("inconnu"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Article");

            verify(articleMapper, never()).toResponse(any());
        }
    }

    @Nested
    @DisplayName("getByIdForAdmin() — accès admin par ID")
    class GetByIdForAdminTests {

        @Test
        @DisplayName("Retourne l'article quelle que soit son statut")
        void shouldReturnArticleRegardlessOfStatus() {
            given(articleRepository.findById(1L)).willReturn(Optional.of(testArticle));
            given(articleMapper.toResponse(testArticle)).willReturn(testArticleResponse);

            ArticleResponse result = articleService.getByIdForAdmin(1L);

            assertThat(result).isNotNull();
        }

        @Test
        @DisplayName("Lance ResourceNotFoundException si l'ID n'existe pas")
        void shouldThrowNotFoundWhenIdDoesNotExist() {
            given(articleRepository.findById(99L)).willReturn(Optional.empty());

            assertThatThrownBy(() -> articleService.getByIdForAdmin(99L))
                .isInstanceOf(ResourceNotFoundException.class);
        }
    }

    @Nested
    @DisplayName("deleteArticle() — suppression définitive")
    class DeleteArticleTests {

        @Test
        @DisplayName("Supprime l'article de manière définitive (hard delete)")
        void shouldHardDeleteArticle() {
            given(articleRepository.findById(1L)).willReturn(Optional.of(testArticle));

            articleService.deleteArticle(1L);

            verify(articleRepository).delete(testArticle);
        }

        @Test
        @DisplayName("Lance ResourceNotFoundException si l'article n'existe pas")
        void shouldThrowNotFoundWhenArticleDoesNotExist() {
            given(articleRepository.findById(99L)).willReturn(Optional.empty());

            assertThatThrownBy(() -> articleService.deleteArticle(99L))
                .isInstanceOf(ResourceNotFoundException.class);
        }
    }
}
```

- [ ] **Step 2 : Lancer les tests pour vérifier l'échec**

Run: `mvn test -Dtest=ArticleServiceTest -q` (depuis `backend/`)
Expected: FAIL (échec de compilation — `ArticleService` n'existe pas encore).

- [ ] **Step 3 : Implémenter `ArticleService`**

Fichier `backend/src/main/java/com/portfolio/backend/service/ArticleService.java` :

```java
package com.portfolio.backend.service;

import com.portfolio.backend.dto.request.ArticleRequest;
import com.portfolio.backend.dto.response.ArticleResponse;
import com.portfolio.backend.dto.response.PageResponse;
import com.portfolio.backend.entity.Article;
import com.portfolio.backend.entity.ArticleStatus;
import com.portfolio.backend.entity.User;
import com.portfolio.backend.exception.ResourceNotFoundException;
import com.portfolio.backend.mapper.ArticleMapper;
import com.portfolio.backend.repository.ArticleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.regex.Pattern;

@Service
@Transactional
public class ArticleService {

    private static final Logger log = LoggerFactory.getLogger(ArticleService.class);
    private static final Pattern NON_ALPHANUMERIC = Pattern.compile("[^a-z0-9]+");
    private static final Pattern DIACRITICS = Pattern.compile("\\p{InCombiningDiacriticalMarks}+");

    private final ArticleRepository articleRepository;
    private final ArticleMapper articleMapper;

    public ArticleService(ArticleRepository articleRepository, ArticleMapper articleMapper) {
        this.articleRepository = articleRepository;
        this.articleMapper = articleMapper;
    }

    @Transactional(readOnly = true)
    public PageResponse<ArticleResponse> getPublished(Pageable pageable, String tag) {
        Page<Article> page = (tag == null || tag.isBlank())
            ? articleRepository.findByStatusOrderByPublishedAtDesc(ArticleStatus.PUBLISHED, pageable)
            : articleRepository.findByStatusAndTag(ArticleStatus.PUBLISHED, tag, pageable);
        return PageResponse.from(page.map(articleMapper::toResponse));
    }

    @Transactional(readOnly = true)
    public ArticleResponse getPublishedBySlug(String slug) {
        Article article = articleRepository.findBySlugAndStatus(slug, ArticleStatus.PUBLISHED)
            .orElseThrow(() -> new ResourceNotFoundException("Article", "slug", slug));
        return articleMapper.toResponse(article);
    }

    @Transactional(readOnly = true)
    public PageResponse<ArticleResponse> getAllForAdmin(Pageable pageable) {
        Page<Article> page = articleRepository.findAllByOrderByCreatedAtDesc(pageable);
        return PageResponse.from(page.map(articleMapper::toResponse));
    }

    @Transactional(readOnly = true)
    public ArticleResponse getByIdForAdmin(Long id) {
        return articleMapper.toResponse(findArticleOrThrow(id));
    }

    public ArticleResponse createArticle(ArticleRequest request) {
        log.info("Création d'un nouvel article : {}", request.title());

        User currentUser = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        String slug = generateUniqueSlug(request.title());

        Article article = Article.builder()
            .title(request.title())
            .slug(slug)
            .summary(request.summary())
            .content(request.content())
            .coverImageUrl(request.coverImageUrl())
            .tags(request.tags() != null ? new ArrayList<>(request.tags()) : new ArrayList<>())
            .status(request.status())
            .publishedAt(request.status() == ArticleStatus.PUBLISHED ? LocalDateTime.now() : null)
            .user(currentUser)
            .build();

        Article saved = articleRepository.save(article);
        log.info("Article créé avec l'ID: {}", saved.getId());
        return articleMapper.toResponse(saved);
    }

    public ArticleResponse updateArticle(Long id, ArticleRequest request) {
        log.info("Mise à jour de l'article ID: {}", id);

        Article article = findArticleOrThrow(id);
        boolean wasPublished = article.getStatus() == ArticleStatus.PUBLISHED;
        boolean isNowPublished = request.status() == ArticleStatus.PUBLISHED;

        article.setTitle(request.title());
        article.setSummary(request.summary());
        article.setContent(request.content());
        article.setCoverImageUrl(request.coverImageUrl());
        article.setTags(request.tags() != null ? new ArrayList<>(request.tags()) : new ArrayList<>());
        article.setStatus(request.status());
        if (!wasPublished && isNowPublished) {
            article.setPublishedAt(LocalDateTime.now());
        }
        article.setUpdatedAt(LocalDateTime.now());

        Article saved = articleRepository.save(article);
        return articleMapper.toResponse(saved);
    }

    public void deleteArticle(Long id) {
        log.info("Suppression de l'article ID: {}", id);
        Article article = findArticleOrThrow(id);
        articleRepository.delete(article);
    }

    private Article findArticleOrThrow(Long id) {
        return articleRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Article", "id", id));
    }

    private String generateUniqueSlug(String title) {
        String base = slugify(title);
        String candidate = base;
        int suffix = 2;
        while (articleRepository.existsBySlug(candidate)) {
            candidate = base + "-" + suffix;
            suffix++;
        }
        return candidate;
    }

    private String slugify(String input) {
        String normalized = Normalizer.normalize(input, Normalizer.Form.NFD);
        String withoutDiacritics = DIACRITICS.matcher(normalized).replaceAll("");
        String lower = withoutDiacritics.toLowerCase();
        String hyphenated = NON_ALPHANUMERIC.matcher(lower).replaceAll("-");
        return hyphenated.replaceAll("^-+", "").replaceAll("-+$", "");
    }
}
```

- [ ] **Step 4 : Lancer les tests pour vérifier le succès**

Run: `mvn test -Dtest=ArticleServiceTest -q` (depuis `backend/`)
Expected: PASS — tous les tests verts.

- [ ] **Step 5 : Commit**

```bash
git add backend/src/main/java/com/portfolio/backend/service/ArticleService.java backend/src/test/java/com/portfolio/backend/service/ArticleServiceTest.java
git commit -m "feat(backend): ajoute ArticleService (slug, transitions de statut, filtrage par tag)"
```

---

### Task B4 : `ArticleController` + `SecurityConfig` (TDD)

**Files:**
- Create: `backend/src/main/java/com/portfolio/backend/controller/ArticleController.java`
- Modify: `backend/src/main/java/com/portfolio/backend/config/SecurityConfig.java:111-112` et `:124-126`
- Test: `backend/src/test/java/com/portfolio/backend/controller/ArticleControllerTest.java`

**Interfaces:**
- Consumes: `ArticleService` (Task B3), `ArticleRequest`/`ArticleResponse` (Task B2), `ApiResponse<T>`/`PageResponse<T>` (existants).
- Produces: endpoints REST `GET /articles`, `GET /articles/{slug}`, `GET /articles/admin`, `GET /articles/admin/{id}`, `POST /articles`, `PUT /articles/{id}`, `DELETE /articles/{id}` — consommés par le frontend (F3).

**Note de conception (écart mineur par rapport à la spec) :** la spec ne liste que `GET /articles/{slug}` comme endpoint de détail (public, `PUBLISHED` uniquement). Le formulaire d'édition admin (F8) doit cependant pouvoir charger un article `DRAFT` par son ID numérique. Ce plan ajoute donc `GET /articles/admin/{id}` (`@PreAuthorize("hasRole('ADMIN')")`, tous statuts) pour combler ce trou, avec la méthode de service correspondante `getByIdForAdmin` (déjà implémentée en B3).

- [ ] **Step 1 : Écrire le test du contrôleur (échec attendu)**

Fichier `backend/src/test/java/com/portfolio/backend/controller/ArticleControllerTest.java` :

```java
package com.portfolio.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.backend.config.RateLimitConfig;
import com.portfolio.backend.config.SecurityConfig;
import com.portfolio.backend.dto.request.ArticleRequest;
import com.portfolio.backend.dto.response.ArticleResponse;
import com.portfolio.backend.dto.response.PageResponse;
import com.portfolio.backend.entity.ArticleStatus;
import com.portfolio.backend.exception.GlobalExceptionHandler;
import com.portfolio.backend.exception.ResourceNotFoundException;
import com.portfolio.backend.observability.AppMetrics;
import com.portfolio.backend.security.JwtAccessDeniedHandler;
import com.portfolio.backend.security.JwtAuthenticationEntryPoint;
import com.portfolio.backend.security.JwtTokenProvider;
import com.portfolio.backend.service.ArticleService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ArticleController.class)
@Import({GlobalExceptionHandler.class, SecurityConfig.class, RateLimitConfig.class,
    JwtAuthenticationEntryPoint.class, JwtAccessDeniedHandler.class})
@DisplayName("ArticleController — Tests Web Layer")
class ArticleControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private ArticleService articleService;

    @MockBean
    private JwtTokenProvider jwtTokenProvider;

    @MockBean
    private UserDetailsService userDetailsService;

    @MockBean
    private AppMetrics appMetrics;

    private final ArticleResponse sampleArticle = new ArticleResponse(
        1L, "Mon article", "mon-article", "Résumé", "Contenu Markdown", null,
        List.of("kubernetes"), ArticleStatus.PUBLISHED, null, "Amine Charrad", null, null
    );

    @Nested
    @DisplayName("GET /articles — Endpoints publics")
    class PublicEndpointsTests {

        @Test
        @DisplayName("GET /articles retourne 200 sans authentification")
        void shouldReturn200WithoutAuth() throws Exception {
            PageResponse<ArticleResponse> pageResponse = new PageResponse<>(
                List.of(sampleArticle), 0, 10, 1L, 1, true, true
            );
            given(articleService.getPublished(any(), isNull())).willReturn(pageResponse);

            mockMvc.perform(get("/articles"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content[0].slug").value("mon-article"));
        }

        @Test
        @DisplayName("GET /articles/{slug} retourne 404 si l'article n'existe pas ou est en DRAFT")
        void shouldReturn404WhenSlugNotFoundOrDraft() throws Exception {
            given(articleService.getPublishedBySlug("inconnu"))
                .willThrow(new ResourceNotFoundException("Article", "slug", "inconnu"));

            mockMvc.perform(get("/articles/inconnu"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
        }

        @Test
        @DisplayName("GET /articles/{slug} retourne 200 pour un article publié")
        void shouldReturn200ForPublishedSlug() throws Exception {
            given(articleService.getPublishedBySlug("mon-article")).willReturn(sampleArticle);

            mockMvc.perform(get("/articles/mon-article"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("Mon article"));
        }
    }

    @Nested
    @DisplayName("GET /articles/admin — Endpoints admin protégés en lecture")
    class AdminReadEndpointTests {

        @Test
        @DisplayName("GET /articles/admin retourne 401 sans authentification")
        void shouldReturn401WithoutAuth() throws Exception {
            mockMvc.perform(get("/articles/admin"))
                .andExpect(status().isUnauthorized());
        }

        @Test
        @WithMockUser(roles = "USER")
        @DisplayName("GET /articles/admin retourne 403 avec ROLE_USER")
        void shouldReturn403WithUserRole() throws Exception {
            mockMvc.perform(get("/articles/admin"))
                .andExpect(status().isForbidden());
        }

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("GET /articles/admin retourne 200 avec ROLE_ADMIN, tous statuts inclus")
        void shouldReturn200WithAdminRole() throws Exception {
            PageResponse<ArticleResponse> pageResponse = new PageResponse<>(
                List.of(sampleArticle), 0, 50, 1L, 1, true, true
            );
            given(articleService.getAllForAdmin(any())).willReturn(pageResponse);

            mockMvc.perform(get("/articles/admin"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].slug").value("mon-article"));
        }

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("GET /articles/admin/{id} retourne 200 avec ROLE_ADMIN, y compris pour un brouillon")
        void shouldReturn200ForDraftArticleWithAdminRole() throws Exception {
            given(articleService.getByIdForAdmin(1L)).willReturn(sampleArticle);

            mockMvc.perform(get("/articles/admin/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.slug").value("mon-article"));
        }
    }

    @Nested
    @DisplayName("POST /articles — Endpoints admin protégés en écriture")
    class AdminWriteEndpointsTests {

        @Test
        @DisplayName("POST /articles retourne 401 sans authentification")
        void shouldReturn401WithoutAuth() throws Exception {
            mockMvc.perform(post("/articles")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{}"))
                .andExpect(status().isUnauthorized());
        }

        @Test
        @WithMockUser(roles = "USER")
        @DisplayName("POST /articles retourne 403 avec ROLE_USER")
        void shouldReturn403WithUserRole() throws Exception {
            ArticleRequest request = new ArticleRequest(
                "Test", null, "Contenu suffisant", null, List.of(), ArticleStatus.DRAFT
            );

            mockMvc.perform(post("/articles")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
        }

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("POST /articles retourne 201 avec ROLE_ADMIN et données valides")
        void shouldReturn201WithAdminRole() throws Exception {
            ArticleRequest request = new ArticleRequest(
                "Mon article", "Résumé", "Contenu Markdown", null, List.of("kubernetes"), ArticleStatus.DRAFT
            );

            given(articleService.createArticle(any(ArticleRequest.class))).willReturn(sampleArticle);

            mockMvc.perform(post("/articles")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.slug").value("mon-article"));
        }

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("POST /articles retourne 400 avec titre vide")
        void shouldReturn400WithBlankTitle() throws Exception {
            ArticleRequest invalidRequest = new ArticleRequest(
                "", null, "Contenu suffisant", null, List.of(), ArticleStatus.DRAFT
            );

            mockMvc.perform(post("/articles")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.validationErrors.title").exists());
        }

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("PUT /articles/{id} retourne 200 avec ROLE_ADMIN et données valides")
        void shouldReturn200OnValidUpdate() throws Exception {
            ArticleRequest request = new ArticleRequest(
                "Mon article modifié", "Résumé", "Contenu modifié", null, List.of(), ArticleStatus.PUBLISHED
            );

            given(articleService.updateArticle(eq(1L), any(ArticleRequest.class))).willReturn(sampleArticle);

            mockMvc.perform(put("/articles/1")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.slug").value("mon-article"));
        }
    }

    @Nested
    @DisplayName("DELETE /articles/{id} — Suppression définitive")
    class DeleteEndpointTests {

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("DELETE /articles/{id} retourne 204 si succès")
        void shouldReturn204OnSuccessfulDelete() throws Exception {
            doNothing().when(articleService).deleteArticle(eq(1L));

            mockMvc.perform(delete("/articles/1").with(csrf()))
                .andExpect(status().isNoContent());
        }

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("DELETE /articles/{id} retourne 404 si l'article n'existe pas")
        void shouldReturn404WhenArticleNotFound() throws Exception {
            doThrow(new ResourceNotFoundException("Article", "id", 99L))
                .when(articleService).deleteArticle(eq(99L));

            mockMvc.perform(delete("/articles/99").with(csrf()))
                .andExpect(status().isNotFound());
        }
    }
}
```

- [ ] **Step 2 : Lancer les tests pour vérifier l'échec**

Run: `mvn test -Dtest=ArticleControllerTest -q` (depuis `backend/`)
Expected: FAIL (échec de compilation — `ArticleController` n'existe pas encore).

- [ ] **Step 3 : Implémenter `ArticleController`**

Fichier `backend/src/main/java/com/portfolio/backend/controller/ArticleController.java` :

```java
package com.portfolio.backend.controller;

import com.portfolio.backend.dto.request.ArticleRequest;
import com.portfolio.backend.dto.response.ApiResponse;
import com.portfolio.backend.dto.response.ArticleResponse;
import com.portfolio.backend.dto.response.PageResponse;
import com.portfolio.backend.service.ArticleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/articles")
@Tag(name = "Articles", description = "Gestion des articles du blog")
public class ArticleController {

    private final ArticleService articleService;

    public ArticleController(ArticleService articleService) {
        this.articleService = articleService;
    }

    @GetMapping
    @Operation(summary = "Liste des articles publiés",
        description = "Retourne la liste paginée des articles PUBLISHED, filtrable par tag")
    public ResponseEntity<ApiResponse<PageResponse<ArticleResponse>>> getPublishedArticles(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int size,
        @Parameter(description = "Filtre par tag (optionnel)")
        @RequestParam(required = false) String tag
    ) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "publishedAt"));
        return ResponseEntity.ok(ApiResponse.success(articleService.getPublished(pageable, tag)));
    }

    @GetMapping("/admin")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Liste de tous les articles (admin)", security = @SecurityRequirement(name = "bearerAuth"))
    public ResponseEntity<ApiResponse<PageResponse<ArticleResponse>>> getAllArticlesForAdmin(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "50") int size
    ) {
        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(ApiResponse.success(articleService.getAllForAdmin(pageable)));
    }

    @GetMapping("/admin/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Détail d'un article quel que soit son statut (admin)",
        security = @SecurityRequirement(name = "bearerAuth"))
    public ResponseEntity<ApiResponse<ArticleResponse>> getArticleByIdForAdmin(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(articleService.getByIdForAdmin(id)));
    }

    @GetMapping("/{slug}")
    @Operation(summary = "Détail d'un article publié par son slug")
    public ResponseEntity<ApiResponse<ArticleResponse>> getPublishedArticleBySlug(@PathVariable String slug) {
        return ResponseEntity.ok(ApiResponse.success(articleService.getPublishedBySlug(slug)));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Créer un article", security = @SecurityRequirement(name = "bearerAuth"))
    public ResponseEntity<ApiResponse<ArticleResponse>> createArticle(@Valid @RequestBody ArticleRequest request) {
        ArticleResponse created = articleService.createArticle(request);
        return ResponseEntity
            .status(HttpStatus.CREATED)
            .body(ApiResponse.success(created, "Article créé avec succès"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Modifier un article", security = @SecurityRequirement(name = "bearerAuth"))
    public ResponseEntity<ApiResponse<ArticleResponse>> updateArticle(
        @PathVariable Long id,
        @Valid @RequestBody ArticleRequest request
    ) {
        return ResponseEntity.ok(
            ApiResponse.success(articleService.updateArticle(id, request), "Article mis à jour")
        );
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Supprimer un article", security = @SecurityRequirement(name = "bearerAuth"))
    public ResponseEntity<Void> deleteArticle(@PathVariable Long id) {
        articleService.deleteArticle(id);
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 4 : Mettre à jour `SecurityConfig`**

Dans `backend/src/main/java/com/portfolio/backend/config/SecurityConfig.java`, remplacer les lignes 111-112 :

```java
                .requestMatchers(HttpMethod.GET, "/skills").permitAll()
                .requestMatchers(HttpMethod.GET, "/skills/**").permitAll()
```

par :

```java
                .requestMatchers(HttpMethod.GET, "/skills").permitAll()
                .requestMatchers(HttpMethod.GET, "/skills/**").permitAll()
                // Articles : les routes /articles/admin* (ROLE_ADMIN) doivent être déclarées
                // AVANT les routes publiques /articles* — Spring Security évalue les
                // matchers dans l'ordre de déclaration (premier match gagnant).
                .requestMatchers(HttpMethod.GET, "/articles/admin").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/articles/admin/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/articles").permitAll()
                .requestMatchers(HttpMethod.GET, "/articles/**").permitAll()
```

Puis remplacer les lignes 124-126 (désormais décalées de 4 lignes, soit 128-130) :

```java
                .requestMatchers(HttpMethod.POST, "/projects").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/projects/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/projects/**").hasRole("ADMIN")
```

par :

```java
                .requestMatchers(HttpMethod.POST, "/projects").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/projects/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/projects/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/articles").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/articles/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/articles/**").hasRole("ADMIN")
```

- [ ] **Step 5 : Lancer les tests pour vérifier le succès**

Run: `mvn test -Dtest=ArticleControllerTest -q` (depuis `backend/`)
Expected: PASS — tous les tests verts.

- [ ] **Step 6 : Lancer la suite backend complète**

Run: `mvn test -q` (depuis `backend/`)
Expected: PASS — aucune régression sur `ProjectControllerTest`/`SecurityConfig` existants.

- [ ] **Step 7 : Commit**

```bash
git add backend/src/main/java/com/portfolio/backend/controller/ArticleController.java backend/src/main/java/com/portfolio/backend/config/SecurityConfig.java backend/src/test/java/com/portfolio/backend/controller/ArticleControllerTest.java
git commit -m "feat(backend): ajoute ArticleController et les règles de sécurité associées"
```

---

## Frontend

### Task F1 : Dépendances npm + modèle `Article`

**Files:**
- Modify: `frontend/package.json` (via `npm install`)
- Create: `frontend/src/app/shared/models/article.model.ts`

**Interfaces:**
- Produces: `Article` (interface), `ArticleStatus` (`'DRAFT' | 'PUBLISHED'`), `ArticleFormData` (interface) — consommés par F3-F9.

- [ ] **Step 1 : Installer les dépendances**

Run (depuis `frontend/`) :

```bash
npm install marked dompurify
npm install -D @types/dompurify
```

Expected: `frontend/package.json` contient désormais `marked` et `dompurify` dans `dependencies`, `@types/dompurify` dans `devDependencies`.

- [ ] **Step 2 : Créer le modèle `Article`**

Fichier `frontend/src/app/shared/models/article.model.ts` :

```typescript
export type ArticleStatus = 'DRAFT' | 'PUBLISHED';

/**
 * Modèle article — miroir de ArticleResponse Java.
 * readonly : les données reçues de l'API ne doivent pas être mutées directement.
 */
export interface Article {
  readonly id: number;
  readonly title: string;
  readonly slug: string;
  readonly summary?: string;
  readonly content: string;
  readonly coverImageUrl?: string;
  readonly tags: string[];
  readonly status: ArticleStatus;
  readonly publishedAt?: string;
  readonly authorName: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Payload pour créer ou modifier un article — miroir de ArticleRequest Java.
 * Mutable car c'est le formulaire de saisie.
 */
export interface ArticleFormData {
  title: string;
  summary?: string;
  content: string;
  coverImageUrl?: string;
  tags: string[];
  status: ArticleStatus;
}
```

- [ ] **Step 3 : Vérifier la compilation TypeScript**

Run: `npx tsc -p tsconfig.app.json --noEmit` (depuis `frontend/`)
Expected: aucune erreur.

- [ ] **Step 4 : Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/app/shared/models/article.model.ts
git commit -m "feat(frontend): ajoute marked/dompurify et le modèle Article"
```

---

### Task F2 : Clés i18n `fr`/`en`/`de`

**Files:**
- Modify: `frontend/src/assets/i18n/fr.json:175-176`
- Modify: `frontend/src/assets/i18n/en.json:167-168`
- Modify: `frontend/src/assets/i18n/de.json:167-168`

**Interfaces:**
- Produces: clés i18n consommées par F4-F9 (`nav.blog`, `home.latest.*`, `blog.*`, `admin.dashboard.tab.*`/`new.article`/`status.draft`/`status.published`/`deleted.*`/`delete`, `admin.confirm.delete.*`, `admin.form.article.*`, `admin.form.field.content*`/`tags*`/`status*`, `admin.form.preview`).

- [ ] **Step 1 : Ajouter les clés dans `fr.json`**

Dans `frontend/src/assets/i18n/fr.json`, remplacer la fin du fichier (ligne 175-176) :

```json
  "admin.form.saved": "Projet sauvegardé."
}
```

par :

```json
  "admin.form.saved": "Projet sauvegardé.",

  "nav.blog": "Blog",

  "home.latest.title": "Derniers articles",
  "home.latest.empty": "Aucun article publié pour le moment.",
  "home.latest.error": "Impossible de charger les articles.",
  "home.latest.retry": "Réessayer",
  "home.latest.all": "Voir tous les articles",

  "blog.title": "Blog",
  "blog.subtitle": "Articles techniques sur le cloud, la sécurité et le DevOps",
  "blog.loading": "Chargement des articles...",
  "blog.error": "Impossible de charger les articles.",
  "blog.retry": "Réessayer",
  "blog.empty": "Aucun article pour le moment.",
  "blog.prev": "← Précédent",
  "blog.next": "Suivant →",
  "blog.tags.all": "Tous",
  "blog.back": "← Retour au blog",
  "blog.card.readMore": "Lire l'article",
  "blog.detail.loading": "Chargement de l'article...",
  "blog.detail.error": "Article introuvable.",

  "admin.dashboard.tab.projects": "Projets",
  "admin.dashboard.tab.articles": "Articles",
  "admin.dashboard.new.article": "Nouvel article",
  "admin.dashboard.status.draft": "Brouillon",
  "admin.dashboard.status.published": "Publié",
  "admin.dashboard.deleted.success": "Article supprimé.",
  "admin.dashboard.deleted.error": "Erreur lors de la suppression.",
  "admin.dashboard.delete": "Supprimer",

  "admin.confirm.delete.title": "Supprimer l'article",
  "admin.confirm.delete.confirm": "Supprimer",

  "admin.form.article.title.create": "Nouvel article",
  "admin.form.article.title.edit": "Modifier l'article",
  "admin.form.field.content": "Contenu (Markdown) *",
  "admin.form.field.content.error": "Le contenu est obligatoire",
  "admin.form.field.tags": "Tags",
  "admin.form.field.tags.placeholder": "Ajouter un tag...",
  "admin.form.field.status": "Statut",
  "admin.form.field.status.draft": "Brouillon",
  "admin.form.field.status.published": "Publié",
  "admin.form.preview": "Aperçu",
  "admin.form.article.submit.create": "Créer l'article",
  "admin.form.article.submit.edit": "Enregistrer les modifications",
  "admin.form.article.saved": "Article sauvegardé."
}
```

- [ ] **Step 2 : Ajouter les clés dans `en.json`**

Dans `frontend/src/assets/i18n/en.json`, remplacer la fin du fichier (ligne 167-168) :

```json
  "admin.form.saved": "Project saved."
}
```

par :

```json
  "admin.form.saved": "Project saved.",
  "nav.blog": "Blog",
  "home.latest.title": "Latest Articles",
  "home.latest.empty": "No published articles at the moment.",
  "home.latest.error": "Unable to load articles.",
  "home.latest.retry": "Retry",
  "home.latest.all": "View all articles",
  "blog.title": "Blog",
  "blog.subtitle": "Technical articles on cloud, security and DevOps",
  "blog.loading": "Loading articles...",
  "blog.error": "Unable to load articles.",
  "blog.retry": "Retry",
  "blog.empty": "No articles yet.",
  "blog.prev": "← Previous",
  "blog.next": "Next →",
  "blog.tags.all": "All",
  "blog.back": "← Back to blog",
  "blog.card.readMore": "Read article",
  "blog.detail.loading": "Loading article...",
  "blog.detail.error": "Article not found.",
  "admin.dashboard.tab.projects": "Projects",
  "admin.dashboard.tab.articles": "Articles",
  "admin.dashboard.new.article": "New article",
  "admin.dashboard.status.draft": "Draft",
  "admin.dashboard.status.published": "Published",
  "admin.dashboard.deleted.success": "Article deleted.",
  "admin.dashboard.deleted.error": "Error while deleting.",
  "admin.dashboard.delete": "Delete",
  "admin.confirm.delete.title": "Delete article",
  "admin.confirm.delete.confirm": "Delete",
  "admin.form.article.title.create": "New article",
  "admin.form.article.title.edit": "Edit article",
  "admin.form.field.content": "Content (Markdown) *",
  "admin.form.field.content.error": "Content is required",
  "admin.form.field.tags": "Tags",
  "admin.form.field.tags.placeholder": "Add a tag...",
  "admin.form.field.status": "Status",
  "admin.form.field.status.draft": "Draft",
  "admin.form.field.status.published": "Published",
  "admin.form.preview": "Preview",
  "admin.form.article.submit.create": "Create article",
  "admin.form.article.submit.edit": "Save changes",
  "admin.form.article.saved": "Article saved."
}
```

- [ ] **Step 3 : Ajouter les clés dans `de.json`**

Dans `frontend/src/assets/i18n/de.json`, remplacer la fin du fichier (ligne 167-168) :

```json
  "admin.form.saved": "Projekt gespeichert."
}
```

par :

```json
  "admin.form.saved": "Projekt gespeichert.",
  "nav.blog": "Blog",
  "home.latest.title": "Neueste Artikel",
  "home.latest.empty": "Momentan keine veröffentlichten Artikel.",
  "home.latest.error": "Artikel konnten nicht geladen werden.",
  "home.latest.retry": "Erneut versuchen",
  "home.latest.all": "Alle Artikel ansehen",
  "blog.title": "Blog",
  "blog.subtitle": "Technische Artikel über Cloud, Sicherheit und DevOps",
  "blog.loading": "Artikel werden geladen...",
  "blog.error": "Artikel konnten nicht geladen werden.",
  "blog.retry": "Erneut versuchen",
  "blog.empty": "Noch keine Artikel.",
  "blog.prev": "← Zurück",
  "blog.next": "Weiter →",
  "blog.tags.all": "Alle",
  "blog.back": "← Zurück zum Blog",
  "blog.card.readMore": "Artikel lesen",
  "blog.detail.loading": "Artikel wird geladen...",
  "blog.detail.error": "Artikel nicht gefunden.",
  "admin.dashboard.tab.projects": "Projekte",
  "admin.dashboard.tab.articles": "Artikel",
  "admin.dashboard.new.article": "Neuer Artikel",
  "admin.dashboard.status.draft": "Entwurf",
  "admin.dashboard.status.published": "Veröffentlicht",
  "admin.dashboard.deleted.success": "Artikel gelöscht.",
  "admin.dashboard.deleted.error": "Fehler beim Löschen.",
  "admin.dashboard.delete": "Löschen",
  "admin.confirm.delete.title": "Artikel löschen",
  "admin.confirm.delete.confirm": "Löschen",
  "admin.form.article.title.create": "Neuer Artikel",
  "admin.form.article.title.edit": "Artikel bearbeiten",
  "admin.form.field.content": "Inhalt (Markdown) *",
  "admin.form.field.content.error": "Inhalt ist erforderlich",
  "admin.form.field.tags": "Tags",
  "admin.form.field.tags.placeholder": "Tag hinzufügen...",
  "admin.form.field.status": "Status",
  "admin.form.field.status.draft": "Entwurf",
  "admin.form.field.status.published": "Veröffentlicht",
  "admin.form.preview": "Vorschau",
  "admin.form.article.submit.create": "Artikel erstellen",
  "admin.form.article.submit.edit": "Änderungen speichern",
  "admin.form.article.saved": "Artikel gespeichert."
}
```

- [ ] **Step 4 : Vérifier la parité des clés entre les 3 fichiers**

Run (depuis `frontend/`) :

```bash
node -e "const fr=Object.keys(require('./src/assets/i18n/fr.json')).sort();const en=Object.keys(require('./src/assets/i18n/en.json')).sort();const de=Object.keys(require('./src/assets/i18n/de.json')).sort();const diff=(a,b)=>a.filter(k=>!b.includes(k));console.log('fr-en:',diff(fr,en));console.log('fr-de:',diff(fr,de));console.log('en-fr:',diff(en,fr));"
```

Expected: les trois tableaux affichés sont vides (`[]`) — aucune clé manquante dans un fichier par rapport aux autres.

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/assets/i18n/fr.json frontend/src/assets/i18n/en.json frontend/src/assets/i18n/de.json
git commit -m "feat(frontend): ajoute les clés i18n du blog (fr/en/de)"
```

---

### Task F3 : `ArticleService` (TDD)

**Files:**
- Create: `frontend/src/app/core/services/article.service.ts`
- Test: `frontend/src/app/core/services/article.service.spec.ts`

**Interfaces:**
- Consumes: `Article`, `ArticleFormData` (Task F1) ; `ApiResponse<T>`, `PageResponse<T>` (existants) ; `environment.apiUrl` (existant).
- Produces: `ArticleService.getArticles(page?, size?, tag?): Observable<PageResponse<Article>>`, `getArticleBySlug(slug): Observable<Article>`, `getArticlesForAdmin(page?, size?): Observable<PageResponse<Article>>`, `getArticleByIdForAdmin(id): Observable<Article>`, `createArticle(data): Observable<Article>`, `updateArticle(id, data): Observable<Article>`, `deleteArticle(id): Observable<void>` — consommés par F4-F9.

- [ ] **Step 1 : Écrire le test du service (échec attendu)**

Fichier `frontend/src/app/core/services/article.service.spec.ts` :

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { ArticleService } from './article.service';
import { Article, ArticleFormData } from '@shared/models/article.model';

describe('ArticleService', () => {
  let service: ArticleService;
  let httpMock: HttpTestingController;

  const mockArticle: Article = {
    id: 1,
    title: 'Mon article',
    slug: 'mon-article',
    summary: 'Résumé',
    content: 'Contenu **Markdown**',
    coverImageUrl: undefined,
    tags: ['kubernetes'],
    status: 'PUBLISHED',
    publishedAt: '2026-08-09T10:00:00',
    authorName: 'Amine Charrad',
    createdAt: '',
    updatedAt: '',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(ArticleService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getArticles() should send GET with pagination params', () => {
    service.getArticles(0, 9).subscribe((page) => {
      expect(page.content).toHaveLength(1);
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/articles') && r.params.has('page'));
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: { content: [mockArticle], page: 0, size: 9, totalElements: 1, totalPages: 1, first: true, last: true },
    });
  });

  it('getArticles() should include the tag param when provided', () => {
    service.getArticles(0, 9, 'kubernetes').subscribe();

    const req = httpMock.expectOne((r) => r.params.get('tag') === 'kubernetes');
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: { content: [], page: 0, size: 9, totalElements: 0, totalPages: 0, first: true, last: true },
    });
  });

  it('getArticleBySlug() should GET /articles/:slug', () => {
    service.getArticleBySlug('mon-article').subscribe((article) => {
      expect(article.slug).toBe('mon-article');
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/articles/mon-article'));
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: mockArticle });
  });

  it('getArticlesForAdmin() should GET /articles/admin', () => {
    service.getArticlesForAdmin(0, 50).subscribe((page) => {
      expect(page.content).toHaveLength(1);
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/articles/admin'));
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: { content: [mockArticle], page: 0, size: 50, totalElements: 1, totalPages: 1, first: true, last: true },
    });
  });

  it('getArticleByIdForAdmin() should GET /articles/admin/:id', () => {
    service.getArticleByIdForAdmin(1).subscribe((article) => {
      expect(article.id).toBe(1);
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/articles/admin/1'));
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: mockArticle });
  });

  it('createArticle() should POST the form data', () => {
    const formData: ArticleFormData = {
      title: 'Nouveau',
      content: 'Contenu',
      tags: [],
      status: 'DRAFT',
    };

    service.createArticle(formData).subscribe((article) => {
      expect(article.id).toBe(1);
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/articles') && r.method === 'POST');
    expect(req.request.body).toEqual(formData);
    req.flush({ success: true, data: mockArticle });
  });

  it('updateArticle() should PUT the form data', () => {
    const formData: ArticleFormData = {
      title: 'Modifié',
      content: 'Contenu modifié',
      tags: ['kubernetes'],
      status: 'PUBLISHED',
    };

    service.updateArticle(1, formData).subscribe((article) => {
      expect(article.id).toBe(1);
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/articles/1') && r.method === 'PUT');
    expect(req.request.body).toEqual(formData);
    req.flush({ success: true, data: mockArticle });
  });

  it('deleteArticle() should DELETE by id', () => {
    service.deleteArticle(1).subscribe();

    const req = httpMock.expectOne((r) => r.url.endsWith('/articles/1') && r.method === 'DELETE');
    req.flush(null);
  });
});
```

- [ ] **Step 2 : Lancer le test pour vérifier l'échec**

Run: `npm test -- article.service.spec.ts` (depuis `frontend/`)
Expected: FAIL — `Cannot find module './article.service'`.

- [ ] **Step 3 : Implémenter `ArticleService`**

Fichier `frontend/src/app/core/services/article.service.ts` :

```typescript
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ApiResponse, PageResponse } from '@shared/models/api-response.model';
import { Article, ArticleFormData } from '@shared/models/article.model';
import { environment } from '@environments/environment';

@Injectable({ providedIn: 'root' })
export class ArticleService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/articles`;

  getArticles(page = 0, size = 9, tag?: string): Observable<PageResponse<Article>> {
    let params = new HttpParams().set('page', page.toString()).set('size', size.toString());
    if (tag) {
      params = params.set('tag', tag);
    }

    return this.http
      .get<ApiResponse<PageResponse<Article>>>(this.baseUrl, { params })
      .pipe(map((r) => r.data!));
  }

  getArticleBySlug(slug: string): Observable<Article> {
    return this.http
      .get<ApiResponse<Article>>(`${this.baseUrl}/${slug}`)
      .pipe(map((r) => r.data!));
  }

  getArticlesForAdmin(page = 0, size = 50): Observable<PageResponse<Article>> {
    const params = new HttpParams().set('page', page.toString()).set('size', size.toString());

    return this.http
      .get<ApiResponse<PageResponse<Article>>>(`${this.baseUrl}/admin`, { params })
      .pipe(map((r) => r.data!));
  }

  getArticleByIdForAdmin(id: number): Observable<Article> {
    return this.http
      .get<ApiResponse<Article>>(`${this.baseUrl}/admin/${id}`)
      .pipe(map((r) => r.data!));
  }

  createArticle(data: ArticleFormData): Observable<Article> {
    return this.http.post<ApiResponse<Article>>(this.baseUrl, data).pipe(map((r) => r.data!));
  }

  updateArticle(id: number, data: ArticleFormData): Observable<Article> {
    return this.http
      .put<ApiResponse<Article>>(`${this.baseUrl}/${id}`, data)
      .pipe(map((r) => r.data!));
  }

  deleteArticle(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
```

- [ ] **Step 4 : Lancer le test pour vérifier le succès**

Run: `npm test -- article.service.spec.ts` (depuis `frontend/`)
Expected: PASS — tous les tests verts.

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/app/core/services/article.service.ts frontend/src/app/core/services/article.service.spec.ts
git commit -m "feat(frontend): ajoute ArticleService"
```

---

### Task F4 : `ArticleCardComponent`

**Files:**
- Create: `frontend/src/app/shared/components/article-card/article-card.component.ts`

**Interfaces:**
- Consumes: `Article` (Task F1).
- Produces: `<app-article-card [article]="article" />` — consommé par F5 (`BlogListComponent`) et F7 (`home.component.html`).

- [ ] **Step 1 : Créer le composant**

Fichier `frontend/src/app/shared/components/article-card/article-card.component.ts` :

```typescript
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { Article } from '@shared/models/article.model';
import { TranslatePipe } from '@core/pipes/translate.pipe';

@Component({
  selector: 'app-article-card',
  imports: [RouterLink, SlicePipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="article-card card">
      <div class="article-card__image">
        @if (article.coverImageUrl) {
          <img [src]="article.coverImageUrl" [alt]="article.title" loading="lazy" />
        } @else {
          <div class="article-card__placeholder" aria-hidden="true">
            <div class="article-card__placeholder-grid"></div>
            <span class="article-card__placeholder-icon">&lt;/&gt;</span>
          </div>
        }
      </div>

      <div class="article-card__body">
        <h3 class="article-card__title">{{ article.title }}</h3>
        <p class="article-card__summary">
          {{ article.summary || (article.content | slice: 0 : 120) }}...
        </p>

        @if (article.tags.length > 0) {
          <div class="article-card__tags">
            @for (tag of article.tags | slice: 0 : 4; track tag) {
              <span class="badge badge-blue">{{ tag }}</span>
            }
          </div>
        }

        <div class="article-card__actions">
          <a [routerLink]="['/portfolio/blog', article.slug]" class="btn btn-primary btn-sm">
            {{ 'blog.card.readMore' | translate }}
          </a>
        </div>
      </div>
    </article>
  `,
  styles: [
    `
      .article-card {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        padding: 0;
        transition:
          transform 0.25s ease,
          box-shadow 0.25s ease,
          border-color 0.25s ease;
      }
      .article-card:hover {
        transform: translateY(-4px);
        box-shadow:
          0 20px 40px -12px rgba(0, 0, 0, 0.5),
          0 0 20px rgba(59, 130, 246, 0.2);
        border-color: rgba(59, 130, 246, 0.4);
      }
      .article-card__image {
        position: relative;
        height: 200px;
        overflow: hidden;
      }
      .article-card__image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.4s ease;
      }
      .article-card:hover .article-card__image img {
        transform: scale(1.06);
      }
      .article-card__placeholder {
        position: relative;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .article-card__placeholder-grid {
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(rgba(59, 130, 246, 0.07) 1px, transparent 1px),
          linear-gradient(90deg, rgba(59, 130, 246, 0.07) 1px, transparent 1px);
        background-size: 24px 24px;
      }
      .article-card__placeholder-icon {
        position: relative;
        font-family: var(--font-mono);
        font-size: 2.5rem;
        font-weight: 700;
        color: var(--color-accent);
        opacity: 0.3;
        z-index: 1;
      }
      .article-card__body {
        flex: 1;
        padding: var(--spacing-lg);
        display: flex;
        flex-direction: column;
        gap: var(--spacing-sm);
      }
      .article-card__title {
        font-size: var(--font-size-lg);
        font-weight: 600;
        color: var(--color-text-primary);
        margin: 0;
        transition: color var(--transition-fast);
      }
      .article-card:hover .article-card__title {
        color: var(--color-accent);
      }
      .article-card__summary {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        line-height: 1.6;
        flex: 1;
        margin: 0;
      }
      .article-card__tags {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-xs);
      }
      .article-card__actions {
        display: flex;
        gap: var(--spacing-sm);
        margin-top: var(--spacing-sm);
        flex-wrap: wrap;
      }
      .btn-sm {
        padding: 0.375rem 0.875rem;
        font-size: var(--font-size-xs);
      }
    `,
  ],
})
export class ArticleCardComponent {
  @Input({ required: true }) article!: Article;
}
```

- [ ] **Step 2 : Vérifier la compilation TypeScript**

Run: `npx tsc -p tsconfig.app.json --noEmit` (depuis `frontend/`)
Expected: aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add frontend/src/app/shared/components/article-card/article-card.component.ts
git commit -m "feat(frontend): ajoute ArticleCardComponent"
```

---

### Task F5 : `BlogListComponent` (TDD)

**Files:**
- Create: `frontend/src/app/features/portfolio/blog/blog-list/blog-list.component.ts`
- Test: `frontend/src/app/features/portfolio/blog/blog-list/blog-list.component.spec.ts`

**Interfaces:**
- Consumes: `ArticleService.getArticles(page, size, tag)` (Task F3), `ArticleCardComponent` (Task F4), `LoadingSpinnerComponent` (existant), `LanguageService.translate` (existant).
- Produces: `BlogListComponent` (route `/portfolio/blog`) — consommé par F7 (`portfolio.routes.ts`).

- [ ] **Step 1 : Écrire le test du composant (échec attendu)**

Fichier `frontend/src/app/features/portfolio/blog/blog-list/blog-list.component.spec.ts` :

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { BlogListComponent } from './blog-list.component';
import { ArticleService } from '@core/services/article.service';
import { Article } from '@shared/models/article.model';
import { PageResponse } from '@shared/models/api-response.model';

describe('BlogListComponent', () => {
  let fixture: ComponentFixture<BlogListComponent>;
  let component: BlogListComponent;

  const mockArticle: Article = {
    id: 1,
    title: 'Mon article',
    slug: 'mon-article',
    summary: 'Résumé',
    content: 'Contenu',
    coverImageUrl: undefined,
    tags: ['kubernetes'],
    status: 'PUBLISHED',
    publishedAt: '2026-08-09T10:00:00',
    authorName: 'Amine Charrad',
    createdAt: '',
    updatedAt: '',
  };

  const mockPage: PageResponse<Article> = {
    content: [mockArticle],
    page: 0,
    size: 9,
    totalElements: 1,
    totalPages: 1,
    first: true,
    last: true,
  };

  const mockArticleService = {
    getArticles: jest.fn(),
  };

  beforeEach(async () => {
    mockArticleService.getArticles.mockReturnValue(of(mockPage));

    await TestBed.configureTestingModule({
      imports: [BlogListComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [{ provide: ArticleService, useValue: mockArticleService }],
    }).compileComponents();

    fixture = TestBed.createComponent(BlogListComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => jest.clearAllMocks());

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should load articles on init', () => {
    fixture.detectChanges();

    expect(mockArticleService.getArticles).toHaveBeenCalledWith(0, 9, undefined);
    expect(component['pageData']()?.content).toHaveLength(1);
    expect(component['isLoading']()).toBe(false);
  });

  it('should set an error message when loading fails', () => {
    mockArticleService.getArticles.mockReturnValue(throwError(() => new Error('network')));

    fixture.detectChanges();

    expect(component['error']()).toBeTruthy();
    expect(component['isLoading']()).toBe(false);
  });

  it('should reload with the selected tag', () => {
    fixture.detectChanges();
    mockArticleService.getArticles.mockClear();

    component['filterByTag']('kubernetes');

    expect(mockArticleService.getArticles).toHaveBeenCalledWith(0, 9, 'kubernetes');
  });
});
```

- [ ] **Step 2 : Lancer le test pour vérifier l'échec**

Run: `npm test -- blog-list.component.spec.ts` (depuis `frontend/`)
Expected: FAIL — `Cannot find module './blog-list.component'`.

- [ ] **Step 3 : Implémenter `BlogListComponent`**

Fichier `frontend/src/app/features/portfolio/blog/blog-list/blog-list.component.ts` :

```typescript
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';

import { ArticleCardComponent } from '@shared/components/article-card/article-card.component';
import { LoadingSpinnerComponent } from '@shared/components/loading-spinner/loading-spinner.component';
import { LanguageService } from '@core/services/language.service';
import { ArticleService } from '@core/services/article.service';
import { TranslatePipe } from '@core/pipes/translate.pipe';
import { PageResponse } from '@shared/models/api-response.model';
import { Article } from '@shared/models/article.model';

@Component({
  selector: 'app-blog-list',
  imports: [ArticleCardComponent, LoadingSpinnerComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="section blog-page">
      <div class="container">
        <div class="blog-header">
          <h1 class="section-title" style="text-align:left; margin-bottom: 0.5rem">
            {{ 'blog.title' | translate }}
          </h1>
          <p class="section-subtitle" style="text-align:left; margin-bottom: 0">
            {{ 'blog.subtitle' | translate }}
          </p>
        </div>

        @if (allTags().length > 0) {
          <div class="blog-tags">
            <button
              class="badge"
              [class.badge-blue]="selectedTag() === null"
              (click)="filterByTag(null)"
            >
              {{ 'blog.tags.all' | translate }}
            </button>
            @for (tag of allTags(); track tag) {
              <button
                class="badge"
                [class.badge-blue]="selectedTag() === tag"
                (click)="filterByTag(tag)"
              >
                {{ tag }}
              </button>
            }
          </div>
        }

        @if (isLoading()) {
          <app-loading-spinner [message]="'blog.loading' | translate" [fullPage]="true" />
        } @else if (error()) {
          <div class="error-state">
            <div class="error-state__icon" aria-hidden="true">⚠</div>
            <p>{{ error() }}</p>
            <button class="btn btn-outline" (click)="loadArticles()">
              {{ 'blog.retry' | translate }}
            </button>
          </div>
        } @else {
          <div class="grid-projects">
            @for (article of pageData()?.content ?? []; track article.id) {
              <app-article-card [article]="article" />
            } @empty {
              <div class="empty-state">
                <p>{{ 'blog.empty' | translate }}</p>
              </div>
            }
          </div>

          @if (pageData() && pageData()!.totalPages > 1) {
            <nav class="pagination" aria-label="Pagination des articles">
              <button class="btn btn-ghost" [disabled]="pageData()!.first" (click)="prevPage()">
                {{ 'blog.prev' | translate }}
              </button>
              <span class="pagination__info">
                {{ (pageData()?.page ?? 0) + 1 }} / {{ pageData()?.totalPages }}
              </span>
              <button class="btn btn-ghost" [disabled]="pageData()!.last" (click)="nextPage()">
                {{ 'blog.next' | translate }}
              </button>
            </nav>
          }
        }
      </div>
    </div>
  `,
  styles: [
    `
      .blog-header {
        margin-bottom: var(--spacing-lg);
      }
      .blog-tags {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-xs);
        margin-bottom: var(--spacing-2xl);
      }
      .blog-tags button {
        cursor: pointer;
        border: 1px solid var(--color-border);
        background: transparent;
        font: inherit;
      }
      .error-state {
        text-align: center;
        padding: var(--spacing-3xl);
        color: var(--color-text-secondary);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--spacing-md);
      }
      .error-state__icon {
        font-size: 2.5rem;
        color: var(--color-warning);
      }
      .empty-state {
        text-align: center;
        padding: var(--spacing-3xl);
        color: var(--color-text-secondary);
      }
      .pagination {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--spacing-lg);
        margin-top: var(--spacing-2xl);
      }
      .pagination__info {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        font-family: var(--font-mono);
      }
    `,
  ],
})
export class BlogListComponent implements OnInit {
  private readonly articleService = inject(ArticleService);
  private readonly lang = inject(LanguageService);

  protected readonly pageData = signal<PageResponse<Article> | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly selectedTag = signal<string | null>(null);
  protected readonly allTags = signal<string[]>([]);

  private currentPage = 0;

  ngOnInit(): void {
    this.loadArticles();
  }

  protected loadArticles(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.articleService.getArticles(this.currentPage, 9, this.selectedTag() ?? undefined).subscribe({
      next: (data) => {
        this.pageData.set(data);
        this.isLoading.set(false);
        this.updateKnownTags(data.content);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: () => {
        this.error.set(this.lang.translate('blog.error'));
        this.isLoading.set(false);
      },
    });
  }

  protected filterByTag(tag: string | null): void {
    this.selectedTag.set(tag);
    this.currentPage = 0;
    this.loadArticles();
  }

  protected nextPage(): void {
    this.currentPage++;
    this.loadArticles();
  }

  protected prevPage(): void {
    this.currentPage--;
    this.loadArticles();
  }

  private updateKnownTags(articles: Article[]): void {
    const known = new Set(this.allTags());
    articles.forEach((a) => a.tags.forEach((t) => known.add(t)));
    this.allTags.set(Array.from(known).sort());
  }
}
```

- [ ] **Step 4 : Lancer le test pour vérifier le succès**

Run: `npm test -- blog-list.component.spec.ts` (depuis `frontend/`)
Expected: PASS — tous les tests verts.

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/app/features/portfolio/blog/blog-list/blog-list.component.ts frontend/src/app/features/portfolio/blog/blog-list/blog-list.component.spec.ts
git commit -m "feat(frontend): ajoute BlogListComponent"
```

---

### Task F6 : `BlogDetailComponent` (TDD)

**Files:**
- Create: `frontend/src/app/features/portfolio/blog/blog-detail/blog-detail.component.ts`
- Test: `frontend/src/app/features/portfolio/blog/blog-detail/blog-detail.component.spec.ts`

**Interfaces:**
- Consumes: `ArticleService.getArticleBySlug(slug)` (Task F3), `marked`/`dompurify` (Task F1), `LoadingSpinnerComponent` (existant).
- Produces: `BlogDetailComponent` (route `/portfolio/blog/:slug`, `@Input() slug!: string`) — consommé par F7 (`portfolio.routes.ts`).

- [ ] **Step 1 : Écrire le test du composant (échec attendu)**

Fichier `frontend/src/app/features/portfolio/blog/blog-detail/blog-detail.component.spec.ts` :

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { BlogDetailComponent } from './blog-detail.component';
import { ArticleService } from '@core/services/article.service';
import { Article } from '@shared/models/article.model';

describe('BlogDetailComponent', () => {
  let fixture: ComponentFixture<BlogDetailComponent>;
  let component: BlogDetailComponent;

  const mockArticle: Article = {
    id: 1,
    title: 'Mon article',
    slug: 'mon-article',
    summary: 'Résumé',
    content: '# Titre\n\nContenu **gras** et `code`.',
    coverImageUrl: undefined,
    tags: ['kubernetes'],
    status: 'PUBLISHED',
    publishedAt: '2026-08-09T10:00:00',
    authorName: 'Amine Charrad',
    createdAt: '',
    updatedAt: '',
  };

  const mockArticleService = {
    getArticleBySlug: jest.fn(),
  };

  beforeEach(async () => {
    mockArticleService.getArticleBySlug.mockReturnValue(of(mockArticle));

    await TestBed.configureTestingModule({
      imports: [BlogDetailComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [{ provide: ArticleService, useValue: mockArticleService }],
    }).compileComponents();

    fixture = TestBed.createComponent(BlogDetailComponent);
    component = fixture.componentInstance;
    component.slug = 'mon-article';
  });

  afterEach(() => jest.clearAllMocks());

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should load the article and render sanitized HTML from Markdown', () => {
    fixture.detectChanges();

    expect(mockArticleService.getArticleBySlug).toHaveBeenCalledWith('mon-article');
    expect(component['article']()).toEqual(mockArticle);
    expect(component['renderedContent']()).toContain('<h1');
    expect(component['renderedContent']()).toContain('<strong>gras</strong>');
    expect(component['isLoading']()).toBe(false);
  });

  it('should strip script tags from rendered content (XSS)', () => {
    mockArticleService.getArticleBySlug.mockReturnValue(
      of({ ...mockArticle, content: '<script>alert(1)</script>Texte sûr' })
    );

    fixture.detectChanges();

    expect(component['renderedContent']()).not.toContain('<script>');
    expect(component['renderedContent']()).toContain('Texte sûr');
  });

  it('should set a translated error message when the article is not found', () => {
    mockArticleService.getArticleBySlug.mockReturnValue(throwError(() => new Error('404')));

    fixture.detectChanges();

    expect(component['error']()).toBeTruthy();
    expect(component['isLoading']()).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer le test pour vérifier l'échec**

Run: `npm test -- blog-detail.component.spec.ts` (depuis `frontend/`)
Expected: FAIL — `Cannot find module './blog-detail.component'`.

- [ ] **Step 3 : Implémenter `BlogDetailComponent`**

Fichier `frontend/src/app/features/portfolio/blog/blog-detail/blog-detail.component.ts` :

```typescript
import { ChangeDetectionStrategy, Component, Input, OnInit, inject, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

import { LoadingSpinnerComponent } from '@shared/components/loading-spinner/loading-spinner.component';
import { ArticleService } from '@core/services/article.service';
import { LanguageService } from '@core/services/language.service';
import { Article } from '@shared/models/article.model';
import { TranslatePipe } from '@core/pipes/translate.pipe';

/**
 * Détail d'un article de blog.
 *
 * Reçoit le slug via @Input() grâce à withComponentInputBinding()
 * configuré dans app.config.ts (le paramètre de route s'appelle :slug).
 */
@Component({
  selector: 'app-blog-detail',
  imports: [RouterLink, LoadingSpinnerComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isLoading()) {
      <app-loading-spinner [message]="'blog.detail.loading' | translate" [fullPage]="true" />
    } @else if (error()) {
      <div class="section container bd-error">
        <div class="bd-error__icon" aria-hidden="true">⚠</div>
        <p>{{ error() }}</p>
        <a routerLink="/portfolio/blog" class="btn btn-outline">{{ 'blog.back' | translate }}</a>
      </div>
    } @else if (article()) {
      <div class="bd-hero">
        <div class="container">
          <a routerLink="/portfolio/blog" class="bd-back">{{ 'blog.back' | translate }}</a>
          <h1 class="bd-hero__title">{{ article()!.title }}</h1>
          @if (article()!.tags.length > 0) {
            <div class="bd-hero__tags">
              @for (tag of article()!.tags; track tag) {
                <span class="badge badge-blue">{{ tag }}</span>
              }
            </div>
          }
        </div>
      </div>

      <div class="section bd-body">
        <div class="container bd-layout">
          @if (article()!.coverImageUrl) {
            <img [src]="article()!.coverImageUrl" [alt]="article()!.title" class="bd-image" />
          }
          <div class="bd-content" [innerHTML]="renderedHtml()"></div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .bd-hero {
        padding: var(--spacing-2xl) 0 var(--spacing-xl);
        background: var(--color-bg-secondary);
        border-bottom: 1px solid var(--color-border);
      }
      .bd-back {
        display: inline-flex;
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
        margin-bottom: var(--spacing-xl);
        text-decoration: none;
      }
      .bd-back:hover {
        color: var(--color-accent);
      }
      .bd-hero__title {
        font-size: clamp(1.75rem, 4vw, 2.75rem);
        font-weight: 700;
        color: var(--color-text-primary);
        margin: 0 0 var(--spacing-md);
        max-width: 720px;
      }
      .bd-hero__tags {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-xs);
      }
      .bd-layout {
        max-width: 720px;
      }
      .bd-image {
        width: 100%;
        max-height: 420px;
        object-fit: cover;
        border-radius: var(--radius-lg);
        margin-bottom: var(--spacing-xl);
      }
      .bd-content {
        color: var(--color-text-secondary);
        font-size: var(--font-size-lg);
        line-height: 1.8;
      }
      .bd-content ::ng-deep h1,
      .bd-content ::ng-deep h2,
      .bd-content ::ng-deep h3 {
        color: var(--color-text-primary);
        margin: var(--spacing-xl) 0 var(--spacing-md);
      }
      .bd-content ::ng-deep p {
        margin: 0 0 var(--spacing-lg);
      }
      .bd-content ::ng-deep pre {
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: var(--spacing-md);
        overflow-x: auto;
      }
      .bd-content ::ng-deep code {
        font-family: var(--font-mono);
        font-size: var(--font-size-sm);
      }
      .bd-error {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--spacing-lg);
        text-align: center;
      }
      .bd-error__icon {
        font-size: 2.5rem;
        color: var(--color-warning);
      }
    `,
  ],
})
export class BlogDetailComponent implements OnInit {
  /** Injecté depuis le param de route :slug grâce à withComponentInputBinding() */
  @Input() slug!: string;

  private readonly articleService = inject(ArticleService);
  private readonly lang = inject(LanguageService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly article = signal<Article | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.articleService.getArticleBySlug(this.slug).subscribe({
      next: (a) => {
        this.article.set(a);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set(this.lang.translate('blog.detail.error'));
        this.isLoading.set(false);
      },
    });
  }

  protected renderedContent(): string {
    const content = this.article()?.content ?? '';
    const rawHtml = marked.parse(content, { async: false }) as string;
    return DOMPurify.sanitize(rawHtml);
  }

  protected renderedHtml(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.renderedContent());
  }
}
```

- [ ] **Step 4 : Lancer le test pour vérifier le succès**

Run: `npm test -- blog-detail.component.spec.ts` (depuis `frontend/`)
Expected: PASS — tous les tests verts.

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/app/features/portfolio/blog/blog-detail/blog-detail.component.ts frontend/src/app/features/portfolio/blog/blog-detail/blog-detail.component.spec.ts
git commit -m "feat(frontend): ajoute BlogDetailComponent (rendu Markdown sanitizé)"
```

---

### Task F7 : Intégration navbar / routes / page d'accueil (TDD pour la section home)

**Files:**
- Modify: `frontend/src/app/shared/components/navbar/navbar.component.ts:68-73`
- Modify: `frontend/src/app/features/portfolio/portfolio.routes.ts:14-27`
- Modify: `frontend/src/app/features/portfolio/home/home.component.ts`
- Modify: `frontend/src/app/features/portfolio/home/home.component.html:117-146`
- Test: `frontend/src/app/features/portfolio/home/home.component.spec.ts`

**Interfaces:**
- Consumes: `ArticleService.getArticles(page, size)` (Task F3), `ArticleCardComponent` (Task F4), `BlogListComponent`/`BlogDetailComponent` (Tasks F5/F6).
- Produces: navigation complète vers `/portfolio/blog` et `/portfolio/blog/:slug`, section "Derniers articles" sur la page d'accueil.

- [ ] **Step 1 : Ajouter le lien "Blog" dans la navbar**

Dans `frontend/src/app/shared/components/navbar/navbar.component.ts`, remplacer les lignes 68-73 :

```typescript
        <a routerLink="/portfolio/projects" routerLinkActive="active" mat-button class="nav-link">
          {{ 'nav.projects' | translate }}
        </a>
        <a routerLink="/portfolio/skills" routerLinkActive="active" mat-button class="nav-link">
          {{ 'nav.skills' | translate }}
        </a>
      </nav>
```

par :

```typescript
        <a routerLink="/portfolio/projects" routerLinkActive="active" mat-button class="nav-link">
          {{ 'nav.projects' | translate }}
        </a>
        <a routerLink="/portfolio/blog" routerLinkActive="active" mat-button class="nav-link">
          {{ 'nav.blog' | translate }}
        </a>
        <a routerLink="/portfolio/skills" routerLinkActive="active" mat-button class="nav-link">
          {{ 'nav.skills' | translate }}
        </a>
      </nav>
```

- [ ] **Step 2 : Ajouter les routes du blog**

Dans `frontend/src/app/features/portfolio/portfolio.routes.ts`, remplacer les lignes 14-27 :

```typescript
  {
    path: 'projects/:id',
    loadComponent: () =>
      import('./projects/project-detail/project-detail.component').then(
        (m) => m.ProjectDetailComponent
      ),
    title: 'Projet — Portfolio',
  },
  {
    path: 'skills',
    loadComponent: () => import('./skills/skills.component').then((m) => m.SkillsComponent),
    title: 'Compétences — Portfolio',
  },
];
```

par :

```typescript
  {
    path: 'projects/:id',
    loadComponent: () =>
      import('./projects/project-detail/project-detail.component').then(
        (m) => m.ProjectDetailComponent
      ),
    title: 'Projet — Portfolio',
  },
  {
    path: 'blog',
    loadComponent: () =>
      import('./blog/blog-list/blog-list.component').then((m) => m.BlogListComponent),
    title: 'Blog — Portfolio',
  },
  {
    path: 'blog/:slug',
    loadComponent: () =>
      import('./blog/blog-detail/blog-detail.component').then((m) => m.BlogDetailComponent),
    title: 'Article — Portfolio',
  },
  {
    path: 'skills',
    loadComponent: () => import('./skills/skills.component').then((m) => m.SkillsComponent),
    title: 'Compétences — Portfolio',
  },
];
```

- [ ] **Step 3 : Écrire le test de la section "Derniers articles" (échec attendu)**

Remplacer le fichier `frontend/src/app/features/portfolio/home/home.component.spec.ts` en intégralité par :

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';

import { HomeComponent } from './home.component';
import { ProjectService } from '@core/services/project.service';
import { ArticleService } from '@core/services/article.service';
import { Project } from '@shared/models/project.model';
import { Article } from '@shared/models/article.model';

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;
  let component: HomeComponent;

  const mockProject: Project = {
    id: 1,
    title: 'Portfolio DevSecOps',
    description: 'Desc',
    summary: 'Résumé',
    githubUrl: null,
    demoUrl: null,
    imageUrl: null,
    featured: true,
    sortOrder: 1,
    status: 'ACTIVE',
    skills: [],
    createdAt: '',
    updatedAt: '',
  };

  const mockArticle: Article = {
    id: 1,
    title: 'Mon article',
    slug: 'mon-article',
    summary: 'Résumé',
    content: 'Contenu',
    coverImageUrl: undefined,
    tags: ['kubernetes'],
    status: 'PUBLISHED',
    publishedAt: '2026-08-09T10:00:00',
    authorName: 'Amine Charrad',
    createdAt: '',
    updatedAt: '',
  };

  const mockProjectService = {
    getFeaturedProjects: jest.fn(),
    getProjects: jest.fn(),
  };

  const mockArticleService = {
    getArticles: jest.fn(),
  };

  beforeEach(async () => {
    mockArticleService.getArticles.mockReturnValue(
      of({ content: [], page: 0, size: 3, totalElements: 0, totalPages: 0, first: true, last: true })
    );

    await TestBed.configureTestingModule({
      imports: [HomeComponent, RouterTestingModule, HttpClientTestingModule],
      providers: [
        { provide: ProjectService, useValue: mockProjectService },
        { provide: ArticleService, useValue: mockArticleService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => jest.clearAllMocks());

  it('should create', () => {
    mockProjectService.getFeaturedProjects.mockReturnValue(of([]));
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should load featured projects on init', () => {
    mockProjectService.getFeaturedProjects.mockReturnValue(of([mockProject]));
    fixture.detectChanges();
    expect(component['featuredProjects']()).toHaveLength(1);
    expect(component['isLoading']()).toBe(false);
  });

  it('should set error on load failure', () => {
    mockProjectService.getFeaturedProjects.mockReturnValue(throwError(() => new Error('err')));
    fixture.detectChanges();
    expect(component['error']()).toBeTruthy();
    expect(component['isLoading']()).toBe(false);
  });

  it('should retry load on retryLoad()', () => {
    mockProjectService.getFeaturedProjects.mockReturnValue(of([]));
    fixture.detectChanges();
    component['retryLoad']();
    expect(mockProjectService.getFeaturedProjects).toHaveBeenCalledTimes(2);
  });

  it('should load the latest published articles on init', () => {
    mockProjectService.getFeaturedProjects.mockReturnValue(of([]));
    mockArticleService.getArticles.mockReturnValue(
      of({
        content: [mockArticle],
        page: 0,
        size: 3,
        totalElements: 1,
        totalPages: 1,
        first: true,
        last: true,
      })
    );

    fixture.detectChanges();

    expect(mockArticleService.getArticles).toHaveBeenCalledWith(0, 3);
    expect(component['latestArticles']()).toHaveLength(1);
  });

  it('should set isLoadingArticles to false when the articles request fails', () => {
    mockProjectService.getFeaturedProjects.mockReturnValue(of([]));
    mockArticleService.getArticles.mockReturnValue(throwError(() => new Error('network')));

    fixture.detectChanges();

    expect(component['isLoadingArticles']()).toBe(false);
    expect(component['latestArticles']()).toHaveLength(0);
  });
});
```

Note : le mock par défaut de `getArticles` posé dans `beforeEach` (page vide) est nécessaire pour que les 4 tests existants (`should create`, etc.) continuent de fonctionner — `ngOnInit()` va désormais aussi appeler `articleService.getArticles(0, 3)`, qui planterait sur un `jest.fn()` sans valeur de retour.

- [ ] **Step 4 : Lancer le test pour vérifier l'échec**

Run: `npm test -- home.component.spec.ts` (depuis `frontend/`)
Expected: FAIL — `Cannot read properties of undefined (reading 'subscribe')` ou `component['latestArticles']` n'est pas une fonction (le service `ArticleService.getArticles` n'existe pas encore dans le composant réel).

- [ ] **Step 5 : Étendre `HomeComponent`**

Dans `frontend/src/app/features/portfolio/home/home.component.ts` :

1. Ajouter les imports :

```typescript
import { ArticleCardComponent } from '@shared/components/article-card/article-card.component';
import { ArticleService } from '@core/services/article.service';
import { Article } from '@shared/models/article.model';
```

2. Ajouter `ArticleCardComponent` au tableau `imports` du décorateur `@Component` (après `ProjectCardComponent`).

3. Ajouter le champ d'injection (après `private readonly projectService = inject(ProjectService);`) :

```typescript
  private readonly articleService = inject(ArticleService);
```

4. Ajouter les signaux (après `protected readonly error = signal<string | null>(null);`) :

```typescript
  protected readonly latestArticles = signal<Article[]>([]);
  protected readonly isLoadingArticles = signal(true);
  protected readonly articlesError = signal<string | null>(null);
```

5. Dans `ngOnInit()`, ajouter l'appel :

```typescript
  ngOnInit(): void {
    this.loadFeaturedProjects();
    this.loadLatestArticles();
  }
```

6. Ajouter la méthode privée (à côté de `loadFeaturedProjects`) :

```typescript
  private loadLatestArticles(): void {
    this.articleService.getArticles(0, 3).subscribe({
      next: (page) => {
        this.latestArticles.set(page.content);
        this.isLoadingArticles.set(false);
      },
      error: () => {
        this.articlesError.set(this.lang.translate('home.latest.error'));
        this.isLoadingArticles.set(false);
      },
    });
  }
```

7. Ajouter la méthode de retry publique (à côté de `retryLoad`) :

```typescript
  protected retryArticlesLoad(): void {
    this.articlesError.set(null);
    this.isLoadingArticles.set(true);
    this.loadLatestArticles();
  }
```

- [ ] **Step 6 : Ajouter la section "Derniers articles" au template**

Dans `frontend/src/app/features/portfolio/home/home.component.html`, remplacer les lignes 117-146 (la section `<!-- ========== FEATURED PROJECTS ========== -->` complète) par la même section suivie d'une nouvelle section "Derniers articles" :

```html
<!-- ========== FEATURED PROJECTS ========== -->
<section class="section featured">
  <div class="container">
    <h2 class="section-title">{{ 'home.featured.title' | translate }}</h2>

    @if (isLoading()) {
      <app-loading-spinner [message]="'skills.loading' | translate" />
    } @else if (error()) {
      <div class="error-state">
        <p>{{ 'home.featured.error' | translate }}</p>
        <button class="btn btn-outline" (click)="retryLoad()">{{ 'home.featured.retry' | translate }}</button>
      </div>
    } @else if (featuredProjects().length === 0) {
      <div class="empty-state">
        <p>{{ 'home.featured.empty' | translate }}</p>
        <a routerLink="/portfolio/projects" class="btn btn-outline">{{ 'home.featured.all' | translate }}</a>
      </div>
    } @else {
      <div class="grid-projects">
        @for (project of featuredProjects(); track project.id; let i = $index) {
          <app-project-card [project]="project" appScrollReveal revealEffect="deploy" [revealDelay]="i * 80" />
        }
      </div>

      <div class="featured__cta">
        <a routerLink="/portfolio/projects" class="btn btn-outline">{{ 'home.featured.all' | translate }} →</a>
      </div>
    }
  </div>
</section>

<!-- ========== LATEST ARTICLES ========== -->
<section class="section featured">
  <div class="container">
    <h2 class="section-title">{{ 'home.latest.title' | translate }}</h2>

    @if (isLoadingArticles()) {
      <app-loading-spinner [message]="'blog.loading' | translate" />
    } @else if (articlesError()) {
      <div class="error-state">
        <p>{{ 'home.latest.error' | translate }}</p>
        <button class="btn btn-outline" (click)="retryArticlesLoad()">{{ 'home.latest.retry' | translate }}</button>
      </div>
    } @else if (latestArticles().length === 0) {
      <div class="empty-state">
        <p>{{ 'home.latest.empty' | translate }}</p>
      </div>
    } @else {
      <div class="grid-projects">
        @for (article of latestArticles(); track article.id) {
          <app-article-card [article]="article" />
        }
      </div>

      <div class="featured__cta">
        <a routerLink="/portfolio/blog" class="btn btn-outline">{{ 'home.latest.all' | translate }} →</a>
      </div>
    }
  </div>
</section>
```

- [ ] **Step 7 : Lancer le test pour vérifier le succès**

Run: `npm test -- home.component.spec.ts` (depuis `frontend/`)
Expected: PASS — tous les tests verts.

- [ ] **Step 8 : Vérifier la compilation TypeScript**

Run: `npx tsc -p tsconfig.app.json --noEmit` (depuis `frontend/`)
Expected: aucune erreur.

- [ ] **Step 9 : Commit**

```bash
git add frontend/src/app/shared/components/navbar/navbar.component.ts frontend/src/app/features/portfolio/portfolio.routes.ts frontend/src/app/features/portfolio/home/home.component.ts frontend/src/app/features/portfolio/home/home.component.html frontend/src/app/features/portfolio/home/home.component.spec.ts
git commit -m "feat(frontend): intègre le blog dans la navbar, les routes et la home"
```

---

### Task F8 : `ArticleFormComponent` (TDD)

**Files:**
- Create: `frontend/src/app/features/admin/article-form/article-form.component.ts`
- Test: `frontend/src/app/features/admin/article-form/article-form.component.spec.ts`
- Modify: `frontend/src/app/features/admin/admin.routes.ts:11-26`

**Interfaces:**
- Consumes: `ArticleService.createArticle/updateArticle/getArticleByIdForAdmin` (Task F3), `LanguageService.translate` (existant).
- Produces: `ArticleFormComponent` (routes `/admin/articles/new`, `/admin/articles/:id/edit`, `@Input() id?: string`) — consommé par F9 (liens d'édition dans le dashboard).

- [ ] **Step 1 : Écrire le test du composant (échec attendu)**

Fichier `frontend/src/app/features/admin/article-form/article-form.component.spec.ts` :

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ArticleFormComponent } from './article-form.component';
import { ArticleService } from '@core/services/article.service';
import { Article } from '@shared/models/article.model';

describe('ArticleFormComponent', () => {
  let fixture: ComponentFixture<ArticleFormComponent>;
  let component: ArticleFormComponent;

  const mockArticle: Article = {
    id: 1,
    title: 'Mon article',
    slug: 'mon-article',
    summary: 'Résumé',
    content: 'Contenu Markdown',
    coverImageUrl: undefined,
    tags: ['kubernetes'],
    status: 'DRAFT',
    publishedAt: undefined,
    authorName: 'Amine Charrad',
    createdAt: '',
    updatedAt: '',
  };

  const mockArticleService = {
    getArticleByIdForAdmin: jest.fn(),
    createArticle: jest.fn(),
    updateArticle: jest.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ArticleFormComponent,
        RouterTestingModule,
        HttpClientTestingModule,
        MatSnackBarModule,
        NoopAnimationsModule,
      ],
      providers: [{ provide: ArticleService, useValue: mockArticleService }],
    }).compileComponents();

    jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(ArticleFormComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => jest.clearAllMocks());

  it('should create in "new article" mode when no id is provided', () => {
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(component['isEditMode']).toBe(false);
  });

  it('should load the article and patch the form when an id is provided', () => {
    mockArticleService.getArticleByIdForAdmin.mockReturnValue(of(mockArticle));
    component.id = '1';

    fixture.detectChanges();

    expect(mockArticleService.getArticleByIdForAdmin).toHaveBeenCalledWith(1);
    expect(component['form'].get('title')?.value).toBe('Mon article');
    expect(component['tags']()).toEqual(['kubernetes']);
  });

  it('should not submit an invalid form', () => {
    fixture.detectChanges();

    component.onSubmit();

    expect(mockArticleService.createArticle).not.toHaveBeenCalled();
  });

  it('should create the article and navigate to /admin on success', () => {
    fixture.detectChanges();
    mockArticleService.createArticle.mockReturnValue(of(mockArticle));

    component['form'].patchValue({ title: 'Nouveau titre', content: 'Contenu suffisant' });
    component.onSubmit();

    expect(mockArticleService.createArticle).toHaveBeenCalled();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/admin']);
  });

  it('should show an error message when the save fails', () => {
    fixture.detectChanges();
    mockArticleService.createArticle.mockReturnValue(
      throwError(() => ({ status: 0 }))
    );

    component['form'].patchValue({ title: 'Nouveau titre', content: 'Contenu suffisant' });
    component.onSubmit();

    expect(component['errorMessage']()).toBeTruthy();
  });

  it('should add a tag via addTag() and avoid duplicates', () => {
    fixture.detectChanges();

    component.addTag({ value: 'kubernetes', chipInput: { clear: () => {} } } as never);
    component.addTag({ value: 'kubernetes', chipInput: { clear: () => {} } } as never);
    component.addTag({ value: 'docker', chipInput: { clear: () => {} } } as never);

    expect(component['tags']()).toEqual(['kubernetes', 'docker']);
  });

  it('should remove a tag via removeTag()', () => {
    fixture.detectChanges();
    component.addTag({ value: 'kubernetes', chipInput: { clear: () => {} } } as never);

    component.removeTag('kubernetes');

    expect(component['tags']()).toEqual([]);
  });
});
```

- [ ] **Step 2 : Lancer le test pour vérifier l'échec**

Run: `npm test -- article-form.component.spec.ts` (depuis `frontend/`)
Expected: FAIL — `Cannot find module './article-form.component'`.

- [ ] **Step 3 : Implémenter `ArticleFormComponent`**

Fichier `frontend/src/app/features/admin/article-form/article-form.component.ts` :

```typescript
import { ChangeDetectionStrategy, Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule, MatChipInputEvent } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

import { ArticleService } from '@core/services/article.service';
import { LanguageService } from '@core/services/language.service';
import { TranslatePipe } from '@core/pipes/translate.pipe';
import { ArticleStatus } from '@shared/models/article.model';
import { ErrorResponse } from '@shared/models/api-response.model';

const URL_PATTERN = /^https?:\/\/.+/;

@Component({
  selector: 'app-article-form',
  standalone: true,
  imports: [
    TranslatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="section">
      <div class="container container--narrow">
        <div class="form-header">
          <a routerLink="/admin" mat-icon-button [matTooltip]="'admin.form.back' | translate">
            <mat-icon>arrow_back</mat-icon>
          </a>
          <h1>
            {{ (isEditMode ? 'admin.form.article.title.edit' : 'admin.form.article.title.create') | translate }}
          </h1>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="article-form">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'admin.form.field.title' | translate }}</mat-label>
            <input matInput formControlName="title" [placeholder]="'admin.form.placeholder.title' | translate" />
            @if (isInvalid('title')) {
              <mat-error>{{ 'admin.form.field.title.error' | translate }}</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'admin.form.field.summary' | translate }}</mat-label>
            <input
              matInput
              formControlName="summary"
              [placeholder]="'admin.form.placeholder.summary' | translate"
            />
            @if (isInvalid('summary')) {
              <mat-error>{{ 'admin.form.field.summary.error' | translate }}</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'admin.form.field.image' | translate }}</mat-label>
            <input matInput formControlName="coverImageUrl" placeholder="https://..." />
            @if (isInvalid('coverImageUrl')) {
              <mat-error>{{ 'admin.form.field.url.error' | translate }}</mat-error>
            }
          </mat-form-field>

          <div class="tags-section">
            <p class="tags-label">{{ 'admin.form.field.tags' | translate }}</p>
            <mat-chip-grid #chipGrid>
              @for (tag of tags(); track tag) {
                <mat-chip-row (removed)="removeTag(tag)">
                  {{ tag }}
                  <button matChipRemove><mat-icon>cancel</mat-icon></button>
                </mat-chip-row>
              }
              <input
                [placeholder]="'admin.form.field.tags.placeholder' | translate"
                [matChipInputFor]="chipGrid"
                (matChipInputTokenEnd)="addTag($event)"
              />
            </mat-chip-grid>
          </div>

          <div class="content-section">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ 'admin.form.field.content' | translate }}</mat-label>
              <textarea matInput formControlName="content" rows="14"></textarea>
              @if (isInvalid('content')) {
                <mat-error>{{ 'admin.form.field.content.error' | translate }}</mat-error>
              }
            </mat-form-field>

            <div class="content-preview">
              <p class="tags-label">{{ 'admin.form.preview' | translate }}</p>
              <div class="content-preview__body" [innerHTML]="previewHtml()"></div>
            </div>
          </div>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'admin.form.field.status' | translate }}</mat-label>
            <mat-select formControlName="status">
              <mat-option value="DRAFT">{{ 'admin.form.field.status.draft' | translate }}</mat-option>
              <mat-option value="PUBLISHED">{{ 'admin.form.field.status.published' | translate }}</mat-option>
            </mat-select>
          </mat-form-field>

          @if (errorMessage()) {
            <div class="form-error-banner">
              <mat-icon>error_outline</mat-icon>
              {{ errorMessage() }}
            </div>
          }

          <div class="form-actions">
            <a routerLink="/admin" mat-button>{{ 'admin.confirm.cancel' | translate }}</a>
            <button mat-raised-button color="primary" type="submit" [disabled]="isLoading()">
              @if (isLoading()) {
                <mat-progress-spinner mode="indeterminate" diameter="18" />
              }
              {{
                (isEditMode ? 'admin.form.article.submit.edit' : 'admin.form.article.submit.create')
                  | translate
              }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [
    `
      .container--narrow {
        max-width: 960px;
      }
      .form-header {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1.5rem;
      }
      .article-form {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .full-width {
        width: 100%;
      }
      .tags-section {
        margin: 0.5rem 0;
      }
      .tags-label {
        font-size: 0.875rem;
        color: var(--color-text-secondary);
        margin-bottom: 0.5rem;
      }
      .content-section {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        align-items: start;
      }
      .content-preview {
        border: 1px solid var(--color-border);
        border-radius: 0.5rem;
        padding: 0.75rem;
      }
      .content-preview__body {
        max-height: 320px;
        overflow-y: auto;
        color: var(--color-text-secondary);
        font-size: 0.9rem;
        line-height: 1.6;
      }
      .form-error-banner {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        border-radius: 0.5rem;
        background: rgba(239, 68, 68, 0.12);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #fca5a5;
        font-size: 0.875rem;
      }
      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        margin-top: 0.5rem;
      }
      @media (max-width: 720px) {
        .content-section {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class ArticleFormComponent implements OnInit {
  @Input() id?: string;

  private readonly fb = inject(FormBuilder);
  private readonly articleService = inject(ArticleService);
  private readonly router = inject(Router);
  private readonly lang = inject(LanguageService);

  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly tags = signal<string[]>([]);

  protected get isEditMode(): boolean {
    return !!this.id;
  }

  protected readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    summary: ['', [Validators.maxLength(500)]],
    coverImageUrl: ['', [Validators.pattern(URL_PATTERN)]],
    content: ['', [Validators.required]],
    status: ['DRAFT' as ArticleStatus],
  });

  ngOnInit(): void {
    if (this.id) {
      this.articleService.getArticleByIdForAdmin(Number(this.id)).subscribe((a) => {
        this.form.patchValue({
          title: a.title,
          summary: a.summary ?? '',
          coverImageUrl: a.coverImageUrl ?? '',
          content: a.content,
          status: a.status,
        });
        this.tags.set([...a.tags]);
      });
    }
  }

  protected isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.touched && ctrl.invalid);
  }

  protected previewHtml(): string {
    const content = this.form.get('content')?.value ?? '';
    const rawHtml = marked.parse(content, { async: false }) as string;
    return DOMPurify.sanitize(rawHtml);
  }

  addTag(event: MatChipInputEvent): void {
    const value = (event.value ?? '').trim();
    if (value && !this.tags().includes(value)) {
      this.tags.update((current) => [...current, value]);
    }
    event.chipInput?.clear();
  }

  removeTag(tag: string): void {
    this.tags.update((current) => current.filter((t) => t !== tag));
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const data = {
      title: this.form.value.title!,
      summary: this.form.value.summary || undefined,
      coverImageUrl: this.form.value.coverImageUrl || undefined,
      content: this.form.value.content!,
      tags: this.tags(),
      status: this.form.value.status as ArticleStatus,
    };

    const request$ = this.id
      ? this.articleService.updateArticle(Number(this.id), data)
      : this.articleService.createArticle(data);

    request$.subscribe({
      next: () => {
        void this.router.navigate(['/admin']);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.errorMessage.set(this.extractErrorMessage(err));
      },
    });
  }

  private extractErrorMessage(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return this.lang.translate('admin.form.error.network');
    }

    const body = err.error as ErrorResponse | undefined;
    const firstValidationError = body?.validationErrors
      ? Object.values(body.validationErrors)[0]
      : undefined;

    return firstValidationError ?? body?.message ?? this.lang.translate('admin.form.error');
  }
}
```

- [ ] **Step 4 : Lancer le test pour vérifier le succès**

Run: `npm test -- article-form.component.spec.ts` (depuis `frontend/`)
Expected: PASS — tous les tests verts.

- [ ] **Step 5 : Ajouter les routes admin**

Dans `frontend/src/app/features/admin/admin.routes.ts`, remplacer les lignes 11-26 :

```typescript
  {
    path: 'projects/new',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./project-form/project-form.component').then((m) => m.ProjectFormComponent),
    title: 'Nouveau projet',
  },
  {
    path: 'projects/:id/edit',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./project-form/project-form.component').then((m) => m.ProjectFormComponent),
    title: 'Modifier le projet',
  },
];
```

par :

```typescript
  {
    path: 'projects/new',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./project-form/project-form.component').then((m) => m.ProjectFormComponent),
    title: 'Nouveau projet',
  },
  {
    path: 'projects/:id/edit',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./project-form/project-form.component').then((m) => m.ProjectFormComponent),
    title: 'Modifier le projet',
  },
  {
    path: 'articles/new',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./article-form/article-form.component').then((m) => m.ArticleFormComponent),
    title: 'Nouvel article',
  },
  {
    path: 'articles/:id/edit',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./article-form/article-form.component').then((m) => m.ArticleFormComponent),
    title: 'Modifier l\'article',
  },
];
```

- [ ] **Step 6 : Vérifier la compilation TypeScript**

Run: `npx tsc -p tsconfig.app.json --noEmit` (depuis `frontend/`)
Expected: aucune erreur.

- [ ] **Step 7 : Commit**

```bash
git add frontend/src/app/features/admin/article-form/article-form.component.ts frontend/src/app/features/admin/article-form/article-form.component.spec.ts frontend/src/app/features/admin/admin.routes.ts
git commit -m "feat(frontend): ajoute ArticleFormComponent et les routes admin associées"
```

---

### Task F9 : Extension de `DashboardComponent` (table Articles) (TDD)

**Files:**
- Modify: `frontend/src/app/features/admin/dashboard/dashboard.component.ts` (fichier complet remplacé)
- Modify: `frontend/src/app/features/admin/dashboard/dashboard.component.spec.ts` (extension)

**Interfaces:**
- Consumes: `ArticleService.getArticlesForAdmin/deleteArticle` (Task F3), `ArticleFormComponent` (Task F8, via les routes `/admin/articles/:id/edit`), `ConfirmDialogComponent`/`ConfirmDialogData` (existant, inchangé).
- Produces: `DashboardComponent.confirmDeleteArticle(article: Article): void`, `DashboardComponent.animateTable(containerSelector: string): void` (méthode refactorée, remplace la signature sans paramètre).

**Note de conception :** `animateTable()` interrogeait jusqu'ici `.mat-elevation-z2` de façon globale sur tout le composant (`this.el.nativeElement.querySelector`). Avec deux tables (Projets + Articles) partageant cette classe Material, cette requête globale animerait toujours la première table trouvée dans le DOM, quel que soit l'appelant. La méthode est donc refactorée pour accepter un `containerSelector` explicite, et chaque conteneur de table reçoit une classe CSS additionnelle dédiée (`projects-table-container` / `articles-table-container`) en plus de `mat-elevation-z2`.

- [ ] **Step 1 : Étendre le test du dashboard (échec attendu)**

Dans `frontend/src/app/features/admin/dashboard/dashboard.component.spec.ts`, remplacer le fichier entier par :

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { signal } from '@angular/core';

import { DashboardComponent } from './dashboard.component';
import { ProjectService } from '@core/services/project.service';
import { ArticleService } from '@core/services/article.service';
import { AuthService } from '@core/services/auth.service';
import { Project } from '@shared/models/project.model';
import { Article } from '@shared/models/article.model';

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;

  const mockProject: Project = {
    id: 1,
    title: 'Test',
    description: 'Desc',
    summary: undefined,
    githubUrl: undefined,
    demoUrl: undefined,
    imageUrl: undefined,
    featured: false,
    sortOrder: 1,
    status: 'ACTIVE',
    skills: [],
    createdAt: '',
    updatedAt: '',
  };

  const mockArticle: Article = {
    id: 1,
    title: 'Mon article',
    slug: 'mon-article',
    summary: 'Résumé',
    content: 'Contenu',
    coverImageUrl: undefined,
    tags: ['kubernetes'],
    status: 'DRAFT',
    publishedAt: undefined,
    authorName: 'Amine Charrad',
    createdAt: '',
    updatedAt: '',
  };

  const mockProjectService = {
    getProjects: jest.fn(),
    deleteProject: jest.fn(),
  };

  const mockArticleService = {
    getArticlesForAdmin: jest.fn(),
    deleteArticle: jest.fn(),
  };

  const mockAuthService = {
    displayName: signal('Admin'),
    isAuthenticated: jest.fn().mockReturnValue(true),
    isAdmin: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    mockProjectService.getProjects.mockReturnValue(
      of({ content: [mockProject], page: 0, size: 50, totalElements: 1, totalPages: 1, first: true, last: true })
    );
    mockArticleService.getArticlesForAdmin.mockReturnValue(
      of({ content: [mockArticle], page: 0, size: 50, totalElements: 1, totalPages: 1, first: true, last: true })
    );

    await TestBed.configureTestingModule({
      imports: [
        DashboardComponent,
        RouterTestingModule,
        HttpClientTestingModule,
        MatDialogModule,
        MatSnackBarModule,
        NoopAnimationsModule,
      ],
      providers: [
        { provide: ProjectService, useValue: mockProjectService },
        { provide: ArticleService, useValue: mockArticleService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => jest.clearAllMocks());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load projects on init', () => {
    expect(mockProjectService.getProjects).toHaveBeenCalledWith(0, 50);
    expect(component['isLoading']()).toBe(false);
    expect(component['projects']()).toHaveLength(1);
  });

  it('should load articles on init', () => {
    expect(mockArticleService.getArticlesForAdmin).toHaveBeenCalledWith(0, 50);
    expect(component['isLoadingArticles']()).toBe(false);
    expect(component['articles']()).toHaveLength(1);
  });

  it('should open confirm dialog on confirmDelete', () => {
    const openSpy = jest.spyOn(component['dialog'], 'open').mockReturnValue({
      afterClosed: () => of(false),
    } as never);

    component.confirmDelete(mockProject);

    expect(openSpy).toHaveBeenCalled();
  });

  it('should delete project when dialog confirmed', () => {
    mockProjectService.deleteProject.mockReturnValue(of(void 0));
    jest.spyOn(component['dialog'], 'open').mockReturnValue({
      afterClosed: () => of(true),
    } as never);

    component.confirmDelete(mockProject);

    expect(mockProjectService.deleteProject).toHaveBeenCalledWith(1);
    expect(component['projects']()).toHaveLength(0);
  });

  it('should open confirm dialog on confirmDeleteArticle', () => {
    const openSpy = jest.spyOn(component['dialog'], 'open').mockReturnValue({
      afterClosed: () => of(false),
    } as never);

    component.confirmDeleteArticle(mockArticle);

    expect(openSpy).toHaveBeenCalled();
  });

  it('should hard-delete the article when dialog confirmed', () => {
    mockArticleService.deleteArticle.mockReturnValue(of(void 0));
    jest.spyOn(component['dialog'], 'open').mockReturnValue({
      afterClosed: () => of(true),
    } as never);

    component.confirmDeleteArticle(mockArticle);

    expect(mockArticleService.deleteArticle).toHaveBeenCalledWith(1);
    expect(component['articles']()).toHaveLength(0);
  });
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier l'échec**

Run: `npm test -- dashboard.component.spec.ts` (depuis `frontend/`)
Expected: FAIL — `ArticleService` non injecté / `component.confirmDeleteArticle` n'est pas une fonction.

- [ ] **Step 3 : Remplacer `dashboard.component.ts` par la version étendue**

Fichier `frontend/src/app/features/admin/dashboard/dashboard.component.ts` (remplace le fichier existant en intégralité) :

```typescript
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import gsap from 'gsap';

import { ProjectService } from '@core/services/project.service';
import { ArticleService } from '@core/services/article.service';
import { AuthService } from '@core/services/auth.service';
import { LanguageService } from '@core/services/language.service';
import { ScrollAnimationService } from '@core/animation/scroll-animation.service';
import { Project } from '@shared/models/project.model';
import { Article } from '@shared/models/article.model';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { TranslatePipe } from '@core/pipes/translate.pipe';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    TranslatePipe,
    RouterLink,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="section">
      <div class="container">
        <div class="dashboard-header" #header>
          <div>
            <h1>{{ 'admin.dashboard.title' | translate }}</h1>
            <p>{{ 'admin.dashboard.welcome' | translate }} {{ authService.displayName() }}</p>
          </div>
          <a routerLink="/admin/projects/new" mat-raised-button color="primary">
            <mat-icon>add</mat-icon>
            {{ 'admin.dashboard.new' | translate }}
          </a>
        </div>

        @if (isLoading()) {
          <div class="dashboard-loading">
            <mat-spinner diameter="48" />
          </div>
        } @else {
          <div class="mat-elevation-z2 projects-table-container" #tableContainer>
            <table mat-table [dataSource]="projects()" class="dashboard-table">
              <ng-container matColumnDef="title">
                <th mat-header-cell *matHeaderCellDef>
                  {{ 'admin.dashboard.col.title' | translate }}
                </th>
                <td mat-cell *matCellDef="let p">{{ p.title }}</td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>
                  {{ 'admin.dashboard.col.status' | translate }}
                </th>
                <td mat-cell *matCellDef="let p">
                  <mat-chip [class]="p.status === 'ACTIVE' ? 'chip-active' : 'chip-archived'">
                    {{
                      p.status === 'ACTIVE'
                        ? ('admin.dashboard.status.active' | translate)
                        : ('admin.dashboard.status.archived' | translate)
                    }}
                  </mat-chip>
                </td>
              </ng-container>

              <ng-container matColumnDef="featured">
                <th mat-header-cell *matHeaderCellDef>
                  {{ 'admin.dashboard.col.featured' | translate }}
                </th>
                <td mat-cell *matCellDef="let p">
                  <mat-icon [class]="p.featured ? 'icon-star' : 'icon-muted'">
                    {{ p.featured ? 'star' : 'star_border' }}
                  </mat-icon>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>
                  {{ 'admin.dashboard.col.actions' | translate }}
                </th>
                <td mat-cell *matCellDef="let p" class="actions-cell">
                  <div class="actions-wrap">
                    <a
                      [routerLink]="['/admin/projects', p.id, 'edit']"
                      mat-icon-button
                      matTooltip="{{ 'admin.dashboard.edit' | translate }}"
                      color="primary"
                    >
                      <mat-icon>edit</mat-icon>
                    </a>
                    <button
                      mat-icon-button
                      matTooltip="{{ 'admin.dashboard.archive' | translate }}"
                      color="warn"
                      (click)="confirmDelete(p)"
                    >
                      <mat-icon>archive</mat-icon>
                    </button>
                  </div>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns"></tr>

              <tr class="mat-row" *matNoDataRow>
                <td class="mat-cell no-data" [attr.colspan]="columns.length">
                  {{ 'admin.dashboard.empty' | translate }}
                </td>
              </tr>
            </table>
          </div>
        }

        <div class="dashboard-header dashboard-header--articles">
          <h2>{{ 'admin.dashboard.tab.articles' | translate }}</h2>
          <a routerLink="/admin/articles/new" mat-raised-button color="primary">
            <mat-icon>add</mat-icon>
            {{ 'admin.dashboard.new.article' | translate }}
          </a>
        </div>

        @if (isLoadingArticles()) {
          <div class="dashboard-loading">
            <mat-spinner diameter="48" />
          </div>
        } @else {
          <div class="mat-elevation-z2 articles-table-container">
            <table mat-table [dataSource]="articles()" class="dashboard-table">
              <ng-container matColumnDef="title">
                <th mat-header-cell *matHeaderCellDef>
                  {{ 'admin.dashboard.col.title' | translate }}
                </th>
                <td mat-cell *matCellDef="let a">{{ a.title }}</td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>
                  {{ 'admin.dashboard.col.status' | translate }}
                </th>
                <td mat-cell *matCellDef="let a">
                  <mat-chip [class]="a.status === 'PUBLISHED' ? 'chip-active' : 'chip-archived'">
                    {{
                      a.status === 'PUBLISHED'
                        ? ('admin.dashboard.status.published' | translate)
                        : ('admin.dashboard.status.draft' | translate)
                    }}
                  </mat-chip>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>
                  {{ 'admin.dashboard.col.actions' | translate }}
                </th>
                <td mat-cell *matCellDef="let a" class="actions-cell">
                  <div class="actions-wrap">
                    <a
                      [routerLink]="['/admin/articles', a.id, 'edit']"
                      mat-icon-button
                      matTooltip="{{ 'admin.dashboard.edit' | translate }}"
                      color="primary"
                    >
                      <mat-icon>edit</mat-icon>
                    </a>
                    <button
                      mat-icon-button
                      matTooltip="{{ 'admin.dashboard.delete' | translate }}"
                      color="warn"
                      (click)="confirmDeleteArticle(a)"
                    >
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="articleColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: articleColumns"></tr>

              <tr class="mat-row" *matNoDataRow>
                <td class="mat-cell no-data" [attr.colspan]="articleColumns.length">
                  {{ 'admin.dashboard.empty' | translate }}
                </td>
              </tr>
            </table>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .dashboard-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 2rem;
        p {
          margin-top: 0.25rem;
          color: var(--color-text-secondary);
        }
      }
      .dashboard-header--articles {
        margin-top: 3rem;
      }
      .dashboard-loading {
        display: flex;
        justify-content: center;
        padding: 3rem;
      }
      .dashboard-table {
        width: 100%;
      }
      .actions-wrap {
        display: flex;
        align-items: center;
        gap: 0.25rem;
      }
      .no-data {
        text-align: center;
        padding: 2rem !important;
        color: var(--color-text-muted);
      }
      .chip-active {
        --mdc-chip-label-text-color: #34d399;
        background: rgba(16, 185, 129, 0.15) !important;
      }
      .chip-archived {
        --mdc-chip-label-text-color: #fbbf24;
        background: rgba(245, 158, 11, 0.15) !important;
      }
      .icon-star {
        color: #fbbf24;
      }
      .icon-muted {
        color: var(--color-text-muted);
      }
    `,
  ],
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly projectService = inject(ProjectService);
  private readonly articleService = inject(ArticleService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly scrollAnim = inject(ScrollAnimationService);
  private readonly ngZone = inject(NgZone);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly authService = inject(AuthService);
  private readonly lang = inject(LanguageService);

  protected readonly columns = ['title', 'status', 'featured', 'actions'];
  protected readonly articleColumns = ['title', 'status', 'actions'];
  protected readonly projects = signal<Project[]>([]);
  protected readonly articles = signal<Article[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isLoadingArticles = signal(true);

  private headerTl?: gsap.core.Timeline;
  private projectsTableAnimated = false;
  private articlesTableAnimated = false;

  constructor() {
    effect(() => {
      const list = this.projects();
      if (list.length > 0 && !this.projectsTableAnimated && !this.scrollAnim.reducedMotion) {
        this.projectsTableAnimated = true;
        untracked(() => {
          setTimeout(() => this.animateTable('.projects-table-container'), 30);
        });
      }
    });

    effect(() => {
      const list = this.articles();
      if (list.length > 0 && !this.articlesTableAnimated && !this.scrollAnim.reducedMotion) {
        this.articlesTableAnimated = true;
        untracked(() => {
          setTimeout(() => this.animateTable('.articles-table-container'), 30);
        });
      }
    });
  }

  ngOnInit(): void {
    this.projectService.getProjects(0, 50).subscribe({
      next: (data) => {
        this.projects.set(data.content);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });

    this.articleService.getArticlesForAdmin(0, 50).subscribe({
      next: (data) => {
        this.articles.set(data.content);
        this.isLoadingArticles.set(false);
      },
      error: () => this.isLoadingArticles.set(false),
    });
  }

  ngAfterViewInit(): void {
    if (this.scrollAnim.reducedMotion) return;
    this.animateHeader();
  }

  ngOnDestroy(): void {
    this.headerTl?.kill();
  }

  private animateHeader(): void {
    const header = this.el.nativeElement.querySelector<HTMLElement>('.dashboard-header');
    if (!header) return;
    this.ngZone.runOutsideAngular(() => {
      this.headerTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      this.headerTl.from(header, { opacity: 0, y: -24, duration: 0.55 });
    });
  }

  private animateTable(containerSelector: string): void {
    const container = this.el.nativeElement.querySelector<HTMLElement>(containerSelector);
    if (!container) return;
    const rows = Array.from(container.querySelectorAll<HTMLElement>('tr.mat-mdc-row'));

    this.ngZone.runOutsideAngular(() => {
      gsap.from(container, { opacity: 0, y: 20, duration: 0.5, ease: 'power2.out' });
      if (rows.length > 0) {
        gsap.from(rows, {
          opacity: 0,
          x: -16,
          stagger: 0.05,
          duration: 0.4,
          ease: 'power2.out',
          delay: 0.15,
        });
      }
    });
  }

  confirmDelete(project: Project): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.lang.translate('admin.confirm.archive.title'),
        message: `${this.lang.translate('admin.confirm.archive.title')} « ${project.title} » ?`,
        confirmLabel: this.lang.translate('admin.confirm.archive.confirm'),
        confirmColor: 'warn',
      },
    });

    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.projectService.deleteProject(project.id).subscribe({
        next: () => {
          this.projects.update((list) => list.filter((p) => p.id !== project.id));
          this.snackBar.open(this.lang.translate('admin.dashboard.archived.success'), 'OK', {
            duration: 3000,
          });
        },
        error: () => {
          this.snackBar.open(this.lang.translate('admin.dashboard.archived.error'), 'OK', {
            duration: 4000,
          });
        },
      });
    });
  }

  confirmDeleteArticle(article: Article): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.lang.translate('admin.confirm.delete.title'),
        message: `${this.lang.translate('admin.confirm.delete.title')} « ${article.title} » ?`,
        confirmLabel: this.lang.translate('admin.confirm.delete.confirm'),
        confirmColor: 'warn',
      },
    });

    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.articleService.deleteArticle(article.id).subscribe({
        next: () => {
          this.articles.update((list) => list.filter((a) => a.id !== article.id));
          this.snackBar.open(this.lang.translate('admin.dashboard.deleted.success'), 'OK', {
            duration: 3000,
          });
        },
        error: () => {
          this.snackBar.open(this.lang.translate('admin.dashboard.deleted.error'), 'OK', {
            duration: 4000,
          });
        },
      });
    });
  }
}
```

- [ ] **Step 4 : Lancer les tests pour vérifier le succès**

Run: `npm test -- dashboard.component.spec.ts` (depuis `frontend/`)
Expected: PASS — tous les tests verts.

- [ ] **Step 5 : Lancer la suite frontend complète**

Run: `npm test` (depuis `frontend/`)
Expected: PASS — aucune régression sur les specs existants (`project-list`, `project-detail`, `home`, `project-form`, etc.).

- [ ] **Step 6 : Vérifier la compilation TypeScript**

Run: `npx tsc -p tsconfig.app.json --noEmit` (depuis `frontend/`)
Expected: aucune erreur.

- [ ] **Step 7 : Commit**

```bash
git add frontend/src/app/features/admin/dashboard/dashboard.component.ts frontend/src/app/features/admin/dashboard/dashboard.component.spec.ts
git commit -m "feat(frontend): ajoute la table Articles au dashboard admin (suppression definitive)"
```

---

## Vérification finale

- [ ] **Backend complet** : `mvn test -q` (depuis `backend/`) — PASS.
- [ ] **Frontend complet** : `npm test` (depuis `frontend/`) — PASS.
- [ ] **Frontend build** : `npm run build:dev` (depuis `frontend/`) — build réussi (valide que `marked`/`dompurify` sont correctement résolus en configuration de build, pas seulement en test).
