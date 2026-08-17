package com.portfolio.backend.service;

import com.portfolio.backend.dto.request.ChangePasswordRequest;
import com.portfolio.backend.dto.request.LoginRequest;
import com.portfolio.backend.dto.response.AuthResponse;
import com.portfolio.backend.entity.Role;
import com.portfolio.backend.entity.User;
import com.portfolio.backend.exception.UnauthorizedException;
import com.portfolio.backend.kafka.EventPublisher;
import com.portfolio.backend.observability.AppMetrics;
import com.portfolio.backend.repository.UserRepository;
import com.portfolio.backend.security.JwtTokenProvider;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.MDC;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * Tests unitaires du AuthService.
 *
 * <p>On teste :
 * - Login réussi : token généré, métriques incrémentées, MDC userId peuplé
 * - Login échoué (BadCredentials) : exception propagée, métriques NON incrémentées
 *
 * <p>Pas de Spring Context : MockitoExtension uniquement → ultra-rapide.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("AuthService — Tests unitaires")
class AuthServiceTest {

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @Mock
    private AppMetrics metrics;

    @Mock
    private EventPublisher eventPublisher;

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private Authentication authentication;

    @InjectMocks
    private AuthService authService;

    private User testUser;

    @BeforeEach
    void setUp() {
        // Injecter la valeur @Value (non injectée par Mockito)
        ReflectionTestUtils.setField(authService, "jwtExpirationMs", 86400000L);

        testUser = User.builder()
            .id(1L)
            .email("admin@portfolio.dev")
            .password("$2b$12$hashed")
            .firstName("Admin")
            .lastName("Portfolio")
            .role(Role.ADMIN)
            .build();
    }

    @AfterEach
    void tearDown() {
        // Nettoyer le MDC après chaque test (Virtual Threads)
        MDC.clear();
    }

    @Nested
    @DisplayName("login() — Succès")
    class LoginSuccessTests {

        @Test
        @DisplayName("Retourne un AuthResponse avec token et infos utilisateur")
        void shouldReturnAuthResponseOnSuccess() {
            // GIVEN
            LoginRequest request = new LoginRequest("admin@portfolio.dev", "Admin@2024!");
            given(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .willReturn(authentication);
            given(authentication.getPrincipal()).willReturn(testUser);
            given(jwtTokenProvider.generateToken(any(Authentication.class))).willReturn("jwt.token.here");

            // WHEN
            AuthResponse response = authService.login(request);

            // THEN
            assertThat(response).isNotNull();
            assertThat(response.token()).isEqualTo("jwt.token.here");
            assertThat(response.expiresIn()).isEqualTo(86400L); // 86400000ms / 1000
            assertThat(response.user()).isNotNull();
            assertThat(response.user().email()).isEqualTo("admin@portfolio.dev");
            assertThat(response.user().role()).isEqualTo("ADMIN");
        }

        @Test
        @DisplayName("Incrémente la métrique auth_login_success_total")
        void shouldIncrementLoginSuccessMetric() {
            // GIVEN
            LoginRequest request = new LoginRequest("admin@portfolio.dev", "Admin@2024!");
            given(authenticationManager.authenticate(any())).willReturn(authentication);
            given(authentication.getPrincipal()).willReturn(testUser);
            given(jwtTokenProvider.generateToken(any(Authentication.class))).willReturn("token");

            // WHEN
            authService.login(request);

            // THEN
            verify(metrics).incrementLoginSuccess();
            verify(metrics, never()).incrementLoginFailure();
        }

        @Test
        @DisplayName("Peuple le MDC avec userId après auth réussie")
        void shouldPopulateMdcWithUserId() {
            // GIVEN
            LoginRequest request = new LoginRequest("admin@portfolio.dev", "Admin@2024!");
            given(authenticationManager.authenticate(any())).willReturn(authentication);
            given(authentication.getPrincipal()).willReturn(testUser);
            given(jwtTokenProvider.generateToken(any(Authentication.class))).willReturn("token");

            // WHEN
            authService.login(request);

            // THEN — le MDC doit contenir l'email de l'utilisateur
            assertThat(MDC.get("userId")).isEqualTo("admin@portfolio.dev");
        }

        @Test
        @DisplayName("Délègue l'authentification à AuthenticationManager")
        void shouldDelegateToAuthenticationManager() {
            // GIVEN
            LoginRequest request = new LoginRequest("admin@portfolio.dev", "Admin@2024!");
            given(authenticationManager.authenticate(any())).willReturn(authentication);
            given(authentication.getPrincipal()).willReturn(testUser);
            given(jwtTokenProvider.generateToken(any(Authentication.class))).willReturn("token");

            // WHEN
            authService.login(request);

            // THEN — AuthenticationManager doit être appelé avec les bons credentials
            verify(authenticationManager).authenticate(
                new UsernamePasswordAuthenticationToken("admin@portfolio.dev", "Admin@2024!")
            );
        }
    }

    @Nested
    @DisplayName("login() — Échec")
    class LoginFailureTests {

        @Test
        @DisplayName("Propage BadCredentialsException si credentials invalides")
        void shouldPropagateBadCredentialsException() {
            // GIVEN
            LoginRequest request = new LoginRequest("admin@portfolio.dev", "WrongPassword!");
            given(authenticationManager.authenticate(any()))
                .willThrow(new BadCredentialsException("Bad credentials"));

            // WHEN / THEN
            assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(BadCredentialsException.class);
        }

        @Test
        @DisplayName("Ne génère PAS de token si auth échoue")
        void shouldNotGenerateTokenOnFailure() {
            // GIVEN
            LoginRequest request = new LoginRequest("admin@portfolio.dev", "WrongPassword!");
            given(authenticationManager.authenticate(any()))
                .willThrow(new BadCredentialsException("Bad credentials"));

            // WHEN
            assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(BadCredentialsException.class);

            // THEN — generateToken ne doit jamais être appelé
            verify(jwtTokenProvider, never()).generateToken(any(Authentication.class));
        }

        @Test
        @DisplayName("Ne peuple PAS le MDC userId si auth échoue")
        void shouldNotPopulateMdcOnFailure() {
            // GIVEN
            LoginRequest request = new LoginRequest("admin@portfolio.dev", "WrongPassword!");
            given(authenticationManager.authenticate(any()))
                .willThrow(new BadCredentialsException("Bad credentials"));

            // WHEN
            assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(BadCredentialsException.class);

            // THEN — MDC userId ne doit pas être positionné
            assertThat(MDC.get("userId")).isNull();
        }
    }

    @Nested
    @DisplayName("changePassword()")
    class ChangePasswordTests {

        @Test
        @DisplayName("Change le mot de passe si le mot de passe actuel est correct")
        void shouldChangePasswordWhenCurrentPasswordCorrect() {
            // GIVEN
            ChangePasswordRequest request = new ChangePasswordRequest("Admin@2024!", "NewStrongPassword123!");
            given(userRepository.findByEmail("admin@portfolio.dev")).willReturn(Optional.of(testUser));
            given(passwordEncoder.matches("Admin@2024!", testUser.getPassword())).willReturn(true);
            given(passwordEncoder.encode("NewStrongPassword123!")).willReturn("$2b$12$newHashed");

            // WHEN
            authService.changePassword("admin@portfolio.dev", request);

            // THEN
            assertThat(testUser.getPassword()).isEqualTo("$2b$12$newHashed");
            verify(userRepository).save(testUser);
        }

        @Test
        @DisplayName("Rejette avec UnauthorizedException si le mot de passe actuel est incorrect")
        void shouldRejectWhenCurrentPasswordIncorrect() {
            // GIVEN
            ChangePasswordRequest request = new ChangePasswordRequest("WrongCurrent!", "NewStrongPassword123!");
            given(userRepository.findByEmail("admin@portfolio.dev")).willReturn(Optional.of(testUser));
            given(passwordEncoder.matches("WrongCurrent!", testUser.getPassword())).willReturn(false);

            // WHEN / THEN
            assertThatThrownBy(() -> authService.changePassword("admin@portfolio.dev", request))
                .isInstanceOf(UnauthorizedException.class);
            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("Rejette avec UnauthorizedException si l'utilisateur n'existe plus")
        void shouldRejectWhenUserNotFound() {
            // GIVEN
            ChangePasswordRequest request = new ChangePasswordRequest("Admin@2024!", "NewStrongPassword123!");
            given(userRepository.findByEmail("ghost@portfolio.dev")).willReturn(Optional.empty());

            // WHEN / THEN
            assertThatThrownBy(() -> authService.changePassword("ghost@portfolio.dev", request))
                .isInstanceOf(UnauthorizedException.class);
            verify(userRepository, never()).save(any());
        }
    }
}
