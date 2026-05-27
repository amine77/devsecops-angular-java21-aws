package com.portfolio.backend.exception;

import com.portfolio.backend.observability.AppMetrics;
import com.portfolio.backend.security.JwtAccessDeniedHandler;
import com.portfolio.backend.security.JwtAuthenticationEntryPoint;
import com.portfolio.backend.security.JwtTokenProvider;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests du GlobalExceptionHandler.
 *
 * <p>Stratégie : un controller de test interne qui lance les exceptions voulues.
 * @WebMvcTest charge la couche Web + Security.
 * On vérifie que chaque handler retourne le bon code HTTP et le bon JSON.
 */
@WebMvcTest(GlobalExceptionHandlerTest.TestController.class)
@Import(GlobalExceptionHandler.class)
@DisplayName("GlobalExceptionHandler — Tests des handlers d'erreurs")
class GlobalExceptionHandlerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private JwtTokenProvider jwtTokenProvider;

    @MockBean
    private UserDetailsService userDetailsService;

    @MockBean
    private JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint;

    @MockBean
    private JwtAccessDeniedHandler jwtAccessDeniedHandler;

    /**
     * AppMetrics — fourni via SimpleMeterRegistry pour éviter de charger le contexte complet.
     */
    @TestConfiguration
    static class TestConfig {
        @Bean
        AppMetrics appMetrics() {
            return new AppMetrics(new SimpleMeterRegistry());
        }
    }

    /**
     * Controller de test interne — expose des endpoints qui lancent des exceptions ciblées.
     * Accessible sans auth (permitAll pour les tests).
     */
    @RestController
    static class TestController {

        @GetMapping("/test/not-found")
        public void throwNotFound() {
            throw new ResourceNotFoundException("Resource", "id", 99L);
        }

        @GetMapping("/test/illegal-arg")
        public void throwIllegalArg() {
            throw new IllegalArgumentException("Argument invalide fourni");
        }

        @GetMapping("/test/access-denied")
        public void throwAccessDenied() {
            throw new AccessDeniedException("Accès refusé");
        }

        @GetMapping("/test/internal-error")
        public void throwInternalError() {
            throw new RuntimeException("Erreur inattendue du serveur");
        }
    }

    @Nested
    @DisplayName("404 — ResourceNotFoundException")
    class NotFoundTests {

        @Test
        @WithMockUser
        @DisplayName("Retourne 404 avec message et path corrects")
        void shouldReturn404() throws Exception {
            mockMvc.perform(get("/test/not-found"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.error").value("Not Found"))
                .andExpect(jsonPath("$.message").exists())
                .andExpect(jsonPath("$.path").value("/test/not-found"));
        }

        @Test
        @WithMockUser
        @DisplayName("Le message contient le nom de la ressource et l'ID")
        void shouldIncludeResourceDetailsInMessage() throws Exception {
            mockMvc.perform(get("/test/not-found"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value(
                    org.hamcrest.Matchers.containsString("Resource")
                ));
        }
    }

    @Nested
    @DisplayName("400 — IllegalArgumentException")
    class BadRequestTests {

        @Test
        @WithMockUser
        @DisplayName("Retourne 400 avec le message de l'exception")
        void shouldReturn400() throws Exception {
            mockMvc.perform(get("/test/illegal-arg"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.message").value("Argument invalide fourni"));
        }
    }

    @Nested
    @DisplayName("403 — AccessDeniedException")
    class ForbiddenTests {

        @Test
        @WithMockUser
        @DisplayName("Retourne 403 avec message standard")
        void shouldReturn403() throws Exception {
            mockMvc.perform(get("/test/access-denied"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.error").value("Forbidden"));
        }
    }

    @Nested
    @DisplayName("500 — Exception générique")
    class InternalServerErrorTests {

        @Test
        @WithMockUser
        @DisplayName("Retourne 500 avec message générique (sans leaker la stack trace)")
        void shouldReturn500WithGenericMessage() throws Exception {
            mockMvc.perform(get("/test/internal-error"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.error").value("Internal Server Error"))
                // Message générique — PAS le message de l'exception (sécurité)
                .andExpect(jsonPath("$.message").value(
                    "Une erreur interne s'est produite. Veuillez réessayer."
                ));
        }

        @Test
        @WithMockUser
        @DisplayName("Ne lèake PAS le message interne de l'exception en 500")
        void shouldNotLeakInternalMessage() throws Exception {
            mockMvc.perform(get("/test/internal-error"))
                .andExpect(status().isInternalServerError())
                // "Erreur inattendue du serveur" ne doit PAS apparaître dans la réponse
                .andExpect(jsonPath("$.message").value(
                    org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("inattendue")
                    )
                ));
        }
    }
}
