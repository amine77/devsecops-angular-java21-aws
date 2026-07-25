package com.portfolio.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.backend.config.RateLimitConfig;
import com.portfolio.backend.config.SecurityConfig;
import com.portfolio.backend.dto.request.LoginRequest;
import com.portfolio.backend.dto.response.AuthResponse;
import com.portfolio.backend.exception.GlobalExceptionHandler;
import com.portfolio.backend.observability.AppMetrics;
import com.portfolio.backend.security.JwtAccessDeniedHandler;
import com.portfolio.backend.security.JwtAuthenticationEntryPoint;
import com.portfolio.backend.security.JwtTokenProvider;
import com.portfolio.backend.service.AuthService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests du AuthController avec MockMvc.
 *
 * <p>On teste :
 * - POST /auth/login 200 avec credentials valides
 * - POST /auth/login 401 avec mauvais mot de passe
 * - POST /auth/login 400 avec email invalide (Bean Validation)
 * - POST /auth/login 400 avec password trop court (Bean Validation)
 * - POST /auth/login 400 avec body vide
 */
@WebMvcTest(AuthController.class)
@Import({GlobalExceptionHandler.class, SecurityConfig.class, RateLimitConfig.class,
    JwtAuthenticationEntryPoint.class, JwtAccessDeniedHandler.class})
@DisplayName("AuthController — Tests Web Layer")
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AuthService authService;

    @MockBean
    private JwtTokenProvider jwtTokenProvider;

    @MockBean
    private UserDetailsService userDetailsService;

    @MockBean
    private AppMetrics appMetrics;

    private final AuthResponse.UserInfo userInfo = new AuthResponse.UserInfo(
        1L, "admin@portfolio.dev", "Admin", "Portfolio", "ADMIN"
    );

    private final AuthResponse successResponse = AuthResponse.of(
        "eyJhbGciOiJIUzM4NCJ9.test.token", 86400L, userInfo
    );

    @Nested
    @DisplayName("POST /auth/login — Succès")
    class LoginSuccessTests {

        @Test
        @DisplayName("Retourne 200 avec token et infos user quand credentials valides")
        void shouldReturn200WithValidCredentials() throws Exception {
            // GIVEN
            LoginRequest request = new LoginRequest("admin@portfolio.dev", "Admin@2024!");
            given(authService.login(any(LoginRequest.class))).willReturn(successResponse);

            // WHEN / THEN
            mockMvc.perform(post("/auth/login")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request)))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.token").exists())
                .andExpect(jsonPath("$.data.expiresIn").value(86400))
                .andExpect(jsonPath("$.data.user.email").value("admin@portfolio.dev"))
                .andExpect(jsonPath("$.data.user.role").value("ADMIN"));
        }
    }

    @Nested
    @DisplayName("POST /auth/login — Échec authentification")
    class LoginFailureTests {

        @Test
        @DisplayName("Retourne 401 avec message générique si mauvais mot de passe")
        void shouldReturn401WithBadCredentials() throws Exception {
            // GIVEN
            LoginRequest request = new LoginRequest("admin@portfolio.dev", "WrongPass1!");
            given(authService.login(any(LoginRequest.class)))
                .willThrow(new BadCredentialsException("Bad credentials"));

            // WHEN / THEN
            mockMvc.perform(post("/auth/login")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("Unauthorized"))
                // Message générique — ne pas révéler si c'est l'email ou le MDP qui est faux
                .andExpect(jsonPath("$.message").value("Authentification invalide ou token expiré"));
        }
    }

    @Nested
    @DisplayName("POST /auth/login — Validation Bean Validation (400)")
    class ValidationTests {

        @Test
        @DisplayName("Retourne 400 avec erreur 'email' si email invalide")
        void shouldReturn400WithInvalidEmail() throws Exception {
            // GIVEN — email sans @
            LoginRequest request = new LoginRequest("not-an-email", "ValidPass1!");

            // WHEN / THEN
            mockMvc.perform(post("/auth/login")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.validationErrors.email").exists());
        }

        @Test
        @DisplayName("Retourne 400 avec erreur 'email' si email vide")
        void shouldReturn400WithBlankEmail() throws Exception {
            // GIVEN
            LoginRequest request = new LoginRequest("", "ValidPass1!");

            // WHEN / THEN
            mockMvc.perform(post("/auth/login")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.validationErrors.email").exists());
        }

        @Test
        @DisplayName("Retourne 400 avec erreur 'password' si password trop court (< 6 chars)")
        void shouldReturn400WithShortPassword() throws Exception {
            // GIVEN — password de 3 caractères (minimum = 6)
            LoginRequest request = new LoginRequest("admin@portfolio.dev", "abc");

            // WHEN / THEN
            mockMvc.perform(post("/auth/login")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.validationErrors.password").exists());
        }

        @Test
        @DisplayName("Retourne 400 avec erreur 'password' si password vide")
        void shouldReturn400WithBlankPassword() throws Exception {
            // GIVEN
            LoginRequest request = new LoginRequest("admin@portfolio.dev", "");

            // WHEN / THEN
            mockMvc.perform(post("/auth/login")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.validationErrors.password").exists());
        }

        @Test
        @DisplayName("Retourne 400 avec erreurs multiples si email et password invalides")
        void shouldReturn400WithMultipleValidationErrors() throws Exception {
            // GIVEN — les deux champs invalides
            LoginRequest request = new LoginRequest("bad-email", "ab");

            // WHEN / THEN
            mockMvc.perform(post("/auth/login")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.validationErrors.email").exists())
                .andExpect(jsonPath("$.validationErrors.password").exists());
        }
    }
}
