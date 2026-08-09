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
