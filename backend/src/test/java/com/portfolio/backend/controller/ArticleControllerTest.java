package com.portfolio.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.backend.config.RateLimitConfig;
import com.portfolio.backend.config.SecurityConfig;
import com.portfolio.backend.dto.request.ArticleRequest;
import com.portfolio.backend.dto.response.ArticleResponse;
import com.portfolio.backend.dto.response.PageResponse;
import com.portfolio.backend.entity.ArticleContentType;
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
        1L, "Mon article", "mon-article", "Résumé", "Contenu Markdown", ArticleContentType.MARKDOWN, null,
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
                "Test", null, "Contenu suffisant", ArticleContentType.MARKDOWN, null, List.of(), ArticleStatus.DRAFT
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
                "Mon article", "Résumé", "Contenu Markdown", ArticleContentType.MARKDOWN, null, List.of("kubernetes"), ArticleStatus.DRAFT
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
        @DisplayName("POST /articles transmet et retourne contentType=HTML")
        void shouldRoundTripHtmlContentType() throws Exception {
            ArticleRequest request = new ArticleRequest(
                "Article designé", "Résumé", "<html><body>...</body></html>", ArticleContentType.HTML,
                null, List.of(), ArticleStatus.DRAFT
            );
            ArticleResponse htmlResponse = new ArticleResponse(
                2L, "Article designé", "article-designe", "Résumé", "<html><body>...</body></html>",
                ArticleContentType.HTML, null, List.of(), ArticleStatus.DRAFT, null, "Amine Charrad", null, null
            );
            given(articleService.createArticle(any(ArticleRequest.class))).willReturn(htmlResponse);

            mockMvc.perform(post("/articles")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.contentType").value("HTML"));
        }

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("POST /articles retourne 400 avec titre vide")
        void shouldReturn400WithBlankTitle() throws Exception {
            ArticleRequest invalidRequest = new ArticleRequest(
                "", null, "Contenu suffisant", ArticleContentType.MARKDOWN, null, List.of(), ArticleStatus.DRAFT
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
                "Mon article modifié", "Résumé", "Contenu modifié", ArticleContentType.MARKDOWN, null, List.of(), ArticleStatus.PUBLISHED
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
