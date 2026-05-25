package com.portfolio.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Filtre Spring Security qui intercepte chaque requête HTTP pour valider le JWT.
 *
 * <p>Extends OncePerRequestFilter : garantit que le filtre est exécuté
 * UNE SEULE FOIS par requête (même pour les forwards/includes).
 *
 * <p>Flux d'exécution pour chaque requête :
 * 1. Extraire le token du header Authorization: Bearer <token>
 * 2. Valider le token (signature + expiration)
 * 3. Charger l'utilisateur depuis la DB
 * 4. Créer un Authentication object et le mettre dans le SecurityContext
 * 5. La requête continue dans la filter chain
 *
 * <p>Si le token est absent ou invalide : le SecurityContext reste vide.
 * Spring Security refusera l'accès aux endpoints protégés avec 401.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);
    private static final String AUTHORIZATION_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtTokenProvider jwtTokenProvider;
    private final UserDetailsService userDetailsService;

    public JwtAuthenticationFilter(
        JwtTokenProvider jwtTokenProvider,
        UserDetailsService userDetailsService
    ) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.userDetailsService = userDetailsService;
    }

    @Override
    protected void doFilterInternal(
        @NonNull HttpServletRequest request,
        @NonNull HttpServletResponse response,
        @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        try {
            String token = extractTokenFromRequest(request);

            if (StringUtils.hasText(token) && jwtTokenProvider.validateToken(token)) {
                String email = jwtTokenProvider.getEmailFromToken(token);

                // Charge l'utilisateur uniquement si le SecurityContext est vide
                // Raison : éviter des appels DB inutiles si déjà authentifié
                if (SecurityContextHolder.getContext().getAuthentication() == null) {
                    UserDetails userDetails = userDetailsService.loadUserByUsername(email);

                    // Crée l'objet Authentication et le place dans le SecurityContext
                    // UsernamePasswordAuthenticationToken : token d'auth standard Spring Security
                    var authentication = new UsernamePasswordAuthenticationToken(
                        userDetails,
                        null,                        // credentials null (pas de password, JWT suffit)
                        userDetails.getAuthorities() // rôles de l'utilisateur
                    );

                    // Ajoute les détails HTTP (IP, session) à l'authentication
                    authentication.setDetails(
                        new WebAuthenticationDetailsSource().buildDetails(request)
                    );

                    // Place l'authentication dans le SecurityContext
                    // Le SecurityContext est thread-local : valable pour cette requête uniquement
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            }
        } catch (Exception ex) {
            // On log mais on NE bloque pas la requête ici.
            // Spring Security rejettera automatiquement les accès non autorisés.
            log.error("Erreur lors de l'authentification JWT: {}", ex.getMessage());
        }

        // Passe la requête au filtre suivant dans la chaîne
        filterChain.doFilter(request, response);
    }

    /**
     * Extrait le token JWT du header HTTP Authorization.
     *
     * <p>Format attendu : Authorization: Bearer eyJhbGci...
     *
     * @param request la requête HTTP
     * @return le token JWT ou null si absent/malformé
     */
    private String extractTokenFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader(AUTHORIZATION_HEADER);
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith(BEARER_PREFIX)) {
            return bearerToken.substring(BEARER_PREFIX.length());
        }
        return null;
    }
}
