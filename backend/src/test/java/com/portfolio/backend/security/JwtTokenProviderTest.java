package com.portfolio.backend.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.User;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
@DisplayName("JwtTokenProvider — Tests unitaires")
class JwtTokenProviderTest {

    private static final String SECRET =
        "test-secret-key-minimum-256-bits-for-hmac-sha256-algorithm-ci";
    private static final long EXPIRATION_MS = 3600000L; // 1h

    private JwtTokenProvider jwtTokenProvider;

    @BeforeEach
    void setUp() {
        jwtTokenProvider = new JwtTokenProvider(SECRET, EXPIRATION_MS);
    }

    @Nested
    @DisplayName("generateToken()")
    class GenerateToken {

        @Test
        @DisplayName("Génère un token non-null depuis un email")
        void shouldGenerateTokenFromEmail() {
            String token = jwtTokenProvider.generateToken("admin@portfolio.dev");
            assertThat(token).isNotNull().isNotBlank();
        }

        @Test
        @DisplayName("Génère un token depuis un objet Authentication")
        void shouldGenerateTokenFromAuthentication() {
            User userDetails = new User("admin@portfolio.dev", "password", List.of());
            Authentication auth = new UsernamePasswordAuthenticationToken(userDetails, null, List.of());

            String token = jwtTokenProvider.generateToken(auth);
            assertThat(token).isNotNull().isNotBlank();
        }
    }

    @Nested
    @DisplayName("getEmailFromToken()")
    class GetEmailFromToken {

        @Test
        @DisplayName("Extrait l'email du token généré")
        void shouldExtractEmailFromToken() {
            String email = "admin@portfolio.dev";
            String token = jwtTokenProvider.generateToken(email);

            String extracted = jwtTokenProvider.getEmailFromToken(token);
            assertThat(extracted).isEqualTo(email);
        }
    }

    @Nested
    @DisplayName("validateToken()")
    class ValidateToken {

        @Test
        @DisplayName("Valide un token correct")
        void shouldReturnTrueForValidToken() {
            String token = jwtTokenProvider.generateToken("admin@portfolio.dev");
            assertThat(jwtTokenProvider.validateToken(token)).isTrue();
        }

        @Test
        @DisplayName("Rejette un token malformé")
        void shouldReturnFalseForMalformedToken() {
            assertThat(jwtTokenProvider.validateToken("not.a.valid.jwt")).isFalse();
        }

        @Test
        @DisplayName("Rejette un token expiré")
        void shouldReturnFalseForExpiredToken() {
            JwtTokenProvider expiredProvider = new JwtTokenProvider(SECRET, -1L);
            String expiredToken = expiredProvider.generateToken("admin@portfolio.dev");
            assertThat(jwtTokenProvider.validateToken(expiredToken)).isFalse();
        }

        @Test
        @DisplayName("Rejette une chaîne qui n'est pas un JWT")
        void shouldReturnFalseForRandomString() {
            assertThat(jwtTokenProvider.validateToken("thisisnotajwt")).isFalse();
        }
    }
}
