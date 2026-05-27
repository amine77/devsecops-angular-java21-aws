package com.portfolio.backend.service;

import com.portfolio.backend.dto.request.LoginRequest;
import com.portfolio.backend.dto.response.AuthResponse;
import com.portfolio.backend.entity.User;
import com.portfolio.backend.kafka.EventPublisher;
import com.portfolio.backend.kafka.event.UserLoginEvent;
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
 * - Publier un événement Kafka sur {@code auth-events} (audit trail)
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
    private final EventPublisher eventPublisher;

    @Value("${app.jwt.expiration-ms}")
    private long jwtExpirationMs;

    public AuthService(
        AuthenticationManager authenticationManager,
        JwtTokenProvider jwtTokenProvider,
        AppMetrics metrics,
        EventPublisher eventPublisher
    ) {
        this.authenticationManager = authenticationManager;
        this.jwtTokenProvider = jwtTokenProvider;
        this.metrics = metrics;
        this.eventPublisher = eventPublisher;
    }

    /**
     * Authentifie un utilisateur et retourne un JWT.
     *
     * <p>Flux :
     * 1. AuthenticationManager vérifie email + password (BCrypt)
     * 2. Si KO → BadCredentialsException → GlobalExceptionHandler → 401 + event Kafka failure
     * 3. Si OK → génération du JWT + métrique success + event Kafka success + MDC userId
     * 4. Construction de la réponse
     *
     * @param request les credentials (email + password)
     * @return AuthResponse avec le JWT et les infos utilisateur
     */
    public AuthResponse login(LoginRequest request) {
        log.info("Tentative de login pour: {}", request.email());

        Authentication authentication = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(request.email(), request.password())
        );

        User user = (User) authentication.getPrincipal();

        MDC.put("userId", user.getEmail());
        metrics.incrementLoginSuccess();

        // Publie l'événement d'audit sur Kafka (fire-and-forget)
        eventPublisher.publishLoginEvent(
            UserLoginEvent.success(user.getId(), user.getEmail(), user.getRole().name())
        );

        String token = jwtTokenProvider.generateToken(authentication);
        log.info("Login réussi pour: {}", request.email());

        return AuthResponse.of(
            token,
            jwtExpirationMs / 1000,
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
