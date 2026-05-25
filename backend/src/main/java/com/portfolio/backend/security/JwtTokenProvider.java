package com.portfolio.backend.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.UnsupportedJwtException;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * Service de gestion des tokens JWT.
 *
 * <p>Responsabilités :
 * - Générer un JWT après authentification réussie
 * - Valider un JWT reçu dans une requête HTTP
 * - Extraire le username (email) du JWT
 *
 * <p>Algorithme : HMAC-SHA256 (HS256)
 * Raison : simple, performant, adapté à une application mono-instance.
 * Pour une architecture multi-services, préférer RS256 (asymétrique).
 *
 * <p>Structure d'un JWT :
 * Header.Payload.Signature
 * eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbkBwb3J0Zm9saW8uY29tIn0.abc123
 *
 * <p>Payload claims inclus :
 * - sub (subject) : email de l'utilisateur
 * - role : rôle de l'utilisateur
 * - iat (issued at) : timestamp de création
 * - exp (expiration) : timestamp d'expiration
 */
@Component
public class JwtTokenProvider {

    private static final Logger log = LoggerFactory.getLogger(JwtTokenProvider.class);

    private final SecretKey secretKey;
    private final long expirationMs;

    /**
     * Constructeur avec injection des propriétés.
     *
     * <p>@Value injecte les valeurs depuis application.properties.
     * La clé secrète est hashée en HMAC-SHA256 key via Keys.hmacShaKeyFor().
     * Raison : JJWT requiert une clé d'au moins 256 bits pour HS256.
     */
    public JwtTokenProvider(
        @Value("${app.jwt.secret}") String secret,
        @Value("${app.jwt.expiration-ms}") long expirationMs
    ) {
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
    }

    /**
     * Génère un JWT pour l'utilisateur authentifié.
     *
     * @param authentication l'objet Authentication Spring Security (post-login)
     * @return le token JWT sous forme de String
     */
    public String generateToken(Authentication authentication) {
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        return generateToken(userDetails.getUsername());
    }

    /**
     * Génère un JWT pour un email donné.
     *
     * @param email l'email de l'utilisateur
     * @return le token JWT sous forme de String
     */
    public String generateToken(String email) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
            .subject(email)          // "sub" claim : identifiant de l'utilisateur
            .issuedAt(now)           // "iat" claim : date d'émission
            .expiration(expiryDate)  // "exp" claim : date d'expiration
            .signWith(secretKey)     // signature HMAC-SHA256
            .compact();
    }

    /**
     * Extrait l'email (subject) d'un token JWT.
     *
     * @param token le JWT
     * @return l'email de l'utilisateur
     */
    public String getEmailFromToken(String token) {
        return parseClaims(token).getSubject();
    }

    /**
     * Valide un token JWT.
     *
     * @param token le JWT à valider
     * @return true si valide, false sinon
     */
    public boolean validateToken(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (ExpiredJwtException ex) {
            log.warn("JWT token expiré: {}", ex.getMessage());
        } catch (UnsupportedJwtException ex) {
            log.warn("JWT token non supporté: {}", ex.getMessage());
        } catch (MalformedJwtException ex) {
            log.warn("JWT token malformé: {}", ex.getMessage());
        } catch (JwtException ex) {
            log.warn("JWT token invalide: {}", ex.getMessage());
        }
        return false;
    }

    /**
     * Parse et valide les claims d'un token.
     * Lance une exception si le token est invalide ou expiré.
     */
    private Claims parseClaims(String token) {
        return Jwts.parser()
            .verifyWith(secretKey)
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }
}
