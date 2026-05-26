package com.portfolio.backend.service;

import com.portfolio.backend.dto.request.LoginRequest;
import com.portfolio.backend.dto.response.AuthResponse;
import com.portfolio.backend.entity.User;
import com.portfolio.backend.observability.AppMetrics;
import com.portfolio.backend.security.JwtTokenProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

/**
 * Service d'authentification.
 *
 * <p>Responsabilités :
 * - Déléguer la vérification des credentials à Spring Security (AuthenticationManager)
 * - Générer un JWT via JwtTokenProvider
 * - Construire la réponse AuthResponse
 * - Incrémenter les métriques Prometheus (login success/failure)
 * - Peupler le MDC userId pour la traçabilité des logs
 *
 * <p>Le service NE vérifie PAS le password lui-même.
 * Raison : délégation à AuthenticationManager = séparation des responsabilités.
 * Spring Security applique BCrypt + les UserDetails.
 */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;
    private final AppMetrics metrics;

    @Value("${app.jwt.expiration-ms}")
    private long jwtExpirationMs;

    public AuthService(
        AuthenticationManager authenticationManager,
        JwtTokenProvider jwtTokenProvider,
        AppMetrics metrics
    ) {
        this.authenticationManager = authenticationManager;
        this.jwtTokenProvider = jwtTokenProvider;
        this.metrics = metrics;
    }

    /**
     * Authentifie un utilisateur et retourne un JWT.
     *
     * <p>Flux :
     * 1. AuthenticationManager vérifie email + password (BCrypt)
     * 2. Si KO → BadCredentialsException → GlobalExceptionHandler → 401 + métrique failure
     * 3. Si OK → génération du JWT + métrique success + MDC userId
     * 4. Construction de la réponse
     *
     * @param request les credentials (email + password)
     * @return AuthResponse avec le JWT et les infos utilisateur
     */
    public AuthResponse login(LoginRequest request) {
        log.info("Tentative de login pour: {}", request.email());

        // Délègue la vérification à Spring Security
        // Lance BadCredentialsException si invalide → GlobalExceptionHandler → metrics.incrementLoginFailure()
        Authentication authentication = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(request.email(), request.password())
        );

        // Récupère l'utilisateur authentifié
        User user = (User) authentication.getPrincipal();

        // Enrichit le MDC avec l'identité de l'utilisateur
        // Tous les logs suivants dans cette requête incluront "userId" dans le JSON structuré (prod)
        MDC.put("userId", user.getEmail());

        // Incrémente la métrique Prometheus — visible dans Grafana
        metrics.incrementLoginSuccess();

        // Génère le JWT
        String token = jwtTokenProvider.generateToken(authentication);

        log.info("Login réussi pour: {}", request.email());

        // Construit la réponse
        return AuthResponse.of(
            token,
            jwtExpirationMs / 1000,  // Converti en secondes pour le frontend
            new AuthResponse.UserInfo(
                user.getId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getRole().name()
            )
        );
    }
}
