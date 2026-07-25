package com.portfolio.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.backend.config.RateLimitConfig;
import com.portfolio.backend.config.SecurityConfig;
import com.portfolio.backend.dto.request.ProjectRequest;
import com.portfolio.backend.dto.response.PageResponse;
import com.portfolio.backend.dto.response.ProjectResponse;
import com.portfolio.backend.entity.ProjectStatus;
import com.portfolio.backend.exception.GlobalExceptionHandler;
import com.portfolio.backend.exception.ResourceNotFoundException;
import com.portfolio.backend.observability.AppMetrics;
import com.portfolio.backend.security.JwtAccessDeniedHandler;
import com.portfolio.backend.security.JwtAuthenticationEntryPoint;
import com.portfolio.backend.security.JwtTokenProvider;
import com.portfolio.backend.service.ProjectService;
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
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests du ProjectController avec MockMvc.
 *
 * <p>@WebMvcTest : charge UNIQUEMENT la couche web (Controller + Security).
 * Pas de DB, pas de services réels → tests rapides.
 *
 * <p>@MockBean : remplace le service par un mock Mockito.
 *
 * <p>On teste :
 * - Les codes de statut HTTP
 * - La structure des réponses JSON
 * - La sécurité (accès sans token, avec token, avec mauvais rôle)
 * - La validation des inputs (400 si données invalides)
 */
@WebMvcTest(ProjectController.class)
@Import({GlobalExceptionHandler.class, SecurityConfig.class, RateLimitConfig.class,
    JwtAuthenticationEntryPoint.class, JwtAccessDeniedHandler.class})
@DisplayName("ProjectController — Tests Web Layer")
class ProjectControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private ProjectService projectService;

    // Mocks requis pour le chargement du contexte @WebMvcTest avec Spring Security JWT.
    // @WebMvcTest charge SecurityConfig qui injecte JwtAuthenticationFilter (→ JwtTokenProvider)
    // et UserDetailsService (→ UserDetailsServiceImpl → UserRepository non disponible en WebMvcTest).
    @MockBean
    private JwtTokenProvider jwtTokenProvider;

    @MockBean
    private UserDetailsService userDetailsService;

    @MockBean
    private AppMetrics appMetrics;

    private final ProjectResponse sampleProject = new ProjectResponse(
        1L, "Portfolio DevSecOps", "Description complète", "Résumé",
        "https://github.com/test", null, null,
        ProjectStatus.ACTIVE, true, 1, List.of(), null, null
    );

    @Nested
    @DisplayName("GET /projects — Endpoints publics")
    class PublicEndpointsTests {

        @Test
        @DisplayName("GET /projects retourne 200 sans authentification")
        void shouldReturn200WithoutAuth() throws Exception {
            // GIVEN
            PageResponse<ProjectResponse> pageResponse = new PageResponse<>(
                List.of(sampleProject), 0, 10, 1L, 1, true, true
            );
            given(projectService.getAllActiveProjects(any())).willReturn(pageResponse);

            // WHEN / THEN
            mockMvc.perform(get("/projects"))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content[0].title").value("Portfolio DevSecOps"))
                .andExpect(jsonPath("$.data.totalElements").value(1));
        }

        @Test
        @DisplayName("GET /projects/{id} retourne 404 si projet inexistant")
        void shouldReturn404WhenProjectNotFound() throws Exception {
            // GIVEN
            given(projectService.getProjectById(99L))
                .willThrow(new ResourceNotFoundException("Projet", "id", 99L));

            // WHEN / THEN
            mockMvc.perform(get("/projects/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").exists());
        }
    }

    @Nested
    @DisplayName("POST /projects — Endpoints admin protégés")
    class AdminEndpointsTests {

        @Test
        @DisplayName("POST /projects retourne 401 sans authentification")
        void shouldReturn401WithoutAuth() throws Exception {
            mockMvc.perform(post("/projects")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{}"))
                .andExpect(status().isUnauthorized());
        }

        @Test
        @WithMockUser(roles = "USER")
        @DisplayName("POST /projects retourne 403 avec ROLE_USER")
        void shouldReturn403WithUserRole() throws Exception {
            ProjectRequest request = new ProjectRequest(
                "Test", "Description longue de test", null, null, null, null,
                false, 0, List.of()
            );

            mockMvc.perform(post("/projects")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
        }

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("POST /projects retourne 201 avec ROLE_ADMIN et données valides")
        void shouldReturn201WithAdminRole() throws Exception {
            ProjectRequest request = new ProjectRequest(
                "Nouveau Projet", "Description détaillée du projet de test",
                "Résumé", "https://github.com/test", null, null,
                true, 1, List.of()
            );

            given(projectService.createProject(any(ProjectRequest.class)))
                .willReturn(sampleProject);

            mockMvc.perform(post("/projects")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.title").value("Portfolio DevSecOps"));
        }

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("POST /projects retourne 400 avec titre vide")
        void shouldReturn400WithBlankTitle() throws Exception {
            ProjectRequest invalidRequest = new ProjectRequest(
                "", "Description suffisamment longue pour passer la validation",
                null, null, null, null, false, 0, List.of()
            );

            mockMvc.perform(post("/projects")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.validationErrors.title").exists());
        }
    }

    @Nested
    @DisplayName("DELETE /projects/{id} — Soft delete")
    class DeleteEndpointTests {

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("DELETE /projects/{id} retourne 204 si succès")
        void shouldReturn204OnSuccessfulDelete() throws Exception {
            doNothing().when(projectService).deleteProject(eq(1L));

            mockMvc.perform(delete("/projects/1").with(csrf()))
                .andExpect(status().isNoContent());
        }

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("DELETE /projects/{id} retourne 404 si projet inexistant")
        void shouldReturn404WhenProjectNotFound() throws Exception {
            doThrow(new ResourceNotFoundException("Projet", "id", 99L))
                .when(projectService).deleteProject(eq(99L));

            mockMvc.perform(delete("/projects/99").with(csrf()))
                .andExpect(status().isNotFound());
        }
    }
}
