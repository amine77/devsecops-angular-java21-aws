package com.portfolio.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.backend.config.RateLimitConfig;
import com.portfolio.backend.config.SecurityConfig;
import com.portfolio.backend.dto.request.ExperienceRequest;
import com.portfolio.backend.dto.response.ExperienceResponse;
import com.portfolio.backend.exception.GlobalExceptionHandler;
import com.portfolio.backend.exception.ResourceNotFoundException;
import com.portfolio.backend.observability.AppMetrics;
import com.portfolio.backend.security.JwtAccessDeniedHandler;
import com.portfolio.backend.security.JwtAuthenticationEntryPoint;
import com.portfolio.backend.security.JwtTokenProvider;
import com.portfolio.backend.service.ExperienceService;
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

import java.time.LocalDate;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ExperienceController.class)
@Import({GlobalExceptionHandler.class, SecurityConfig.class, RateLimitConfig.class,
    JwtAuthenticationEntryPoint.class, JwtAccessDeniedHandler.class})
@DisplayName("ExperienceController — Tests Web Layer")
class ExperienceControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private ExperienceService experienceService;

    @MockBean
    private JwtTokenProvider jwtTokenProvider;

    @MockBean
    private UserDetailsService userDetailsService;

    @MockBean
    private AppMetrics appMetrics;

    private final ExperienceResponse sampleExperience = new ExperienceResponse(
        1L, "Allianz France", "Tech Lead", null, "Groupe d'assurance international", null,
        LocalDate.of(2020, 6, 1), null, true, "Description", null,
        List.of("Réalisation 1"), List.of(), List.of("Java 21"), 1, null, null
    );

    @Nested
    @DisplayName("GET /experiences — Endpoints publics")
    class PublicEndpointsTests {

        @Test
        @DisplayName("GET /experiences retourne 200 sans authentification")
        void shouldReturn200WithoutAuth() throws Exception {
            given(experienceService.getAll()).willReturn(List.of(sampleExperience));

            mockMvc.perform(get("/experiences"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].entreprise").value("Allianz France"));
        }

        @Test
        @DisplayName("GET /experiences/{id} retourne 200 sans authentification")
        void shouldReturn200ForDetailWithoutAuth() throws Exception {
            given(experienceService.getById(1L)).willReturn(sampleExperience);

            mockMvc.perform(get("/experiences/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.poste").value("Tech Lead"));
        }

        @Test
        @DisplayName("GET /experiences/{id} retourne 404 si l'expérience n'existe pas")
        void shouldReturn404WhenIdNotFound() throws Exception {
            given(experienceService.getById(99L))
                .willThrow(new ResourceNotFoundException("Experience", "id", 99L));

            mockMvc.perform(get("/experiences/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
        }
    }

    @Nested
    @DisplayName("POST /experiences — Endpoints admin protégés en écriture")
    class AdminWriteEndpointsTests {

        @Test
        @DisplayName("POST /experiences retourne 401 sans authentification")
        void shouldReturn401WithoutAuth() throws Exception {
            mockMvc.perform(post("/experiences")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{}"))
                .andExpect(status().isUnauthorized());
        }

        @Test
        @WithMockUser(roles = "USER")
        @DisplayName("POST /experiences retourne 403 avec ROLE_USER")
        void shouldReturn403WithUserRole() throws Exception {
            ExperienceRequest request = new ExperienceRequest(
                "Allianz France", "Tech Lead", "Contexte", LocalDate.of(2020, 6, 1), null,
                "Description", List.of(), List.of(), 1
            );

            mockMvc.perform(post("/experiences")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
        }

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("POST /experiences retourne 201 avec ROLE_ADMIN et données valides")
        void shouldReturn201WithAdminRole() throws Exception {
            ExperienceRequest request = new ExperienceRequest(
                "Allianz France", "Tech Lead", "Contexte", LocalDate.of(2020, 6, 1), null,
                "Description", List.of("Réalisation 1"), List.of("Java 21"), 1
            );
            given(experienceService.createExperience(any(ExperienceRequest.class))).willReturn(sampleExperience);

            mockMvc.perform(post("/experiences")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.entreprise").value("Allianz France"));
        }

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("POST /experiences retourne 400 avec entreprise vide")
        void shouldReturn400WithBlankEntreprise() throws Exception {
            ExperienceRequest invalidRequest = new ExperienceRequest(
                "", "Tech Lead", "Contexte", LocalDate.of(2020, 6, 1), null,
                "Description", List.of(), List.of(), 1
            );

            mockMvc.perform(post("/experiences")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.validationErrors.entreprise").exists());
        }

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("PUT /experiences/{id} retourne 200 avec ROLE_ADMIN et données valides")
        void shouldReturn200OnValidUpdate() throws Exception {
            ExperienceRequest request = new ExperienceRequest(
                "Allianz France", "Tech Lead Senior", "Contexte", LocalDate.of(2020, 6, 1), null,
                "Description modifiée", List.of(), List.of(), 1
            );
            given(experienceService.updateExperience(eq(1L), any(ExperienceRequest.class))).willReturn(sampleExperience);

            mockMvc.perform(put("/experiences/1")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.entreprise").value("Allianz France"));
        }
    }

    @Nested
    @DisplayName("DELETE /experiences/{id} — Suppression définitive")
    class DeleteEndpointTests {

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("DELETE /experiences/{id} retourne 204 si succès")
        void shouldReturn204OnSuccessfulDelete() throws Exception {
            doNothing().when(experienceService).deleteExperience(eq(1L));

            mockMvc.perform(delete("/experiences/1").with(csrf()))
                .andExpect(status().isNoContent());
        }

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("DELETE /experiences/{id} retourne 404 si l'expérience n'existe pas")
        void shouldReturn404WhenExperienceNotFound() throws Exception {
            doThrow(new ResourceNotFoundException("Experience", "id", 99L))
                .when(experienceService).deleteExperience(eq(99L));

            mockMvc.perform(delete("/experiences/99").with(csrf()))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("DELETE /experiences/{id} retourne 401 sans authentification")
        void shouldReturn401WithoutAuth() throws Exception {
            mockMvc.perform(delete("/experiences/1").with(csrf()))
                .andExpect(status().isUnauthorized());
        }
    }
}
