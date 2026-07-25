package com.portfolio.backend.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.backend.config.RateLimitConfig;
import com.portfolio.backend.config.SecurityConfig;
import com.portfolio.backend.controller.AuthController;
import com.portfolio.backend.dto.request.LoginRequest;
import com.portfolio.backend.dto.response.AuthResponse;
import com.portfolio.backend.exception.GlobalExceptionHandler;
import com.portfolio.backend.observability.AppMetrics;
import com.portfolio.backend.service.AuthService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests du rate limiting bout en bout, à travers la chaîne Spring Security.
 *
 * <p>Chaque test utilise une IP distincte : le {@code LoginRateLimiter} est un
 * singleton partagé par le contexte Spring mis en cache, donc l'isolation ne
 * peut pas venir de l'ordre d'exécution.
 *
 * <p>Seuils resserrés ici (2 échecs, 3 requêtes) pour rester rapide. Au passage,
 * ce test vérifie que les durées ISO-8601 des propriétés se lient bien à
 * {@link java.time.Duration}.
 */
@WebMvcTest(AuthController.class)
@Import({GlobalExceptionHandler.class, SecurityConfig.class, RateLimitConfig.class,
    JwtAuthenticationEntryPoint.class, JwtAccessDeniedHandler.class})
@TestPropertySource(properties = {
    "app.rate-limit.login.enabled=true",
    "app.rate-limit.login.max-failures=2",
    "app.rate-limit.login.failure-window=PT15M",
    "app.rate-limit.login.max-attempts=3",
    "app.rate-limit.login.attempt-window=PT1M",
    "app.rate-limit.behind-proxy=true"
})
@DisplayName("LoginRateLimitFilter — 429 avant BCrypt")
class LoginRateLimitFilterTest {

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

    private static final AuthResponse SUCCESS = AuthResponse.of(
        "token", 86400L,
        new AuthResponse.UserInfo(1L, "admin@portfolio.dev", "Admin", "Portfolio", "ADMIN")
    );

    private String body() throws Exception {
        return objectMapper.writeValueAsString(
            new LoginRequest("admin@portfolio.dev", "password123")
        );
    }

    private org.springframework.test.web.servlet.ResultActions login(String ip) throws Exception {
        return mockMvc.perform(post("/auth/login")
            .with(csrf())
            .header("X-Real-IP", ip)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body()));
    }

    @Test
    @DisplayName("Après N échecs, la tentative suivante est refusée sans atteindre AuthService")
    void locksOutAfterRepeatedFailures() throws Exception {
        String ip = "203.0.113.1";
        given(authService.login(any())).willThrow(new BadCredentialsException("bad credentials"));

        login(ip).andExpect(status().isUnauthorized());
        login(ip).andExpect(status().isUnauthorized());

        login(ip)
            .andExpect(status().isTooManyRequests())
            .andExpect(header().exists("Retry-After"))
            .andExpect(jsonPath("$.status").value(429))
            .andExpect(jsonPath("$.error").value("Too Many Requests"))
            .andExpect(jsonPath("$.message").value(
                containsString("tentatives de connexion échouées")));

        // Le cœur du test : la 3e requête n'a jamais déclenché de hash BCrypt.
        verify(authService, times(2)).login(any());
    }

    @Test
    @DisplayName("Le plafond de débit s'applique même quand toutes les connexions réussissent")
    void throttlesSuccessfulRequestsToProtectCpu() throws Exception {
        String ip = "203.0.113.2";
        given(authService.login(any())).willReturn(SUCCESS);

        for (int i = 0; i < 3; i++) {
            login(ip).andExpect(status().isOk());
        }

        login(ip)
            .andExpect(status().isTooManyRequests())
            .andExpect(header().exists("Retry-After"))
            .andExpect(jsonPath("$.message").value(
                containsString("Trop de requêtes")));

        verify(authService, times(3)).login(any());
    }

    @Test
    @DisplayName("Le verrouillage d'une IP ne bloque pas les autres visiteurs")
    void lockoutDoesNotAffectOtherClients() throws Exception {
        given(authService.login(any())).willThrow(new BadCredentialsException("bad credentials"));

        login("203.0.113.3").andExpect(status().isUnauthorized());
        login("203.0.113.3").andExpect(status().isUnauthorized());
        login("203.0.113.3").andExpect(status().isTooManyRequests());

        login("203.0.113.4").andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Les autres endpoints ne sont pas soumis au limiteur")
    void doesNotFilterOtherEndpoints() throws Exception {
        String ip = "203.0.113.5";

        // 20 requêtes sur un autre chemin, très au-delà du plafond de 3 :
        // le filtre doit les ignorer intégralement.
        for (int i = 0; i < 20; i++) {
            mockMvc.perform(post("/projects")
                .with(csrf())
                .header("X-Real-IP", ip)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().is(not(429)));
        }

        verify(authService, never()).login(any());
    }
}
