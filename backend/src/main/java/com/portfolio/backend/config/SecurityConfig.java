package com.portfolio.backend.config;

import com.portfolio.backend.security.JwtAccessDeniedHandler;
import com.portfolio.backend.security.JwtAuthenticationEntryPoint;
import com.portfolio.backend.security.JwtAuthenticationFilter;
import com.portfolio.backend.security.LoginRateLimitFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.AuthorizeHttpRequestsConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

/**
 * Configuration principale de Spring Security.
 *
 * <p>Choix d'architecture sécurité :
 * - JWT stateless : pas de session HTTP côté serveur
 *   Raison : compatible Kubernetes (plusieurs répliques sans sticky session)
 * - BCrypt : hashing des mots de passe (coût 12 = ~300ms/hash → résistant brute-force)
 * - CSRF désactivé : inutile avec JWT (les tokens CSRF protègent les sessions cookies)
 * - CORS configuré via Spring (pas via NGINX pour plus de flexibilité)
 *
 * <p><b>Ordre des filtres</b> : LoginRateLimitFilter s'exécute avant
 * JwtAuthenticationFilter, lui-même avant UsernamePasswordAuthenticationFilter.
 * Cet ordre n'est pas cosmétique — une tentative de connexion refusée par le
 * rate limiter n'atteint jamais BCrypt (coût 12, ~300 ms de CPU par hash).
 * Un limiteur placé après l'authentification protégerait les comptes mais
 * laisserait une rafale de requêtes saturer les 2 vCPU de l'instance.
 *
 * <p>@EnableMethodSecurity : active @PreAuthorize sur les méthodes de service
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final LoginRateLimitFilter loginRateLimitFilter;
    private final UserDetailsService userDetailsService;
    private final JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint;
    private final JwtAccessDeniedHandler jwtAccessDeniedHandler;

    @Value("${app.cors.allowed-origins:http://localhost:4200}")
    private String allowedOrigins;

    public SecurityConfig(
        JwtAuthenticationFilter jwtAuthenticationFilter,
        LoginRateLimitFilter loginRateLimitFilter,
        UserDetailsService userDetailsService,
        JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint,
        JwtAccessDeniedHandler jwtAccessDeniedHandler
    ) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.loginRateLimitFilter = loginRateLimitFilter;
        this.userDetailsService = userDetailsService;
        this.jwtAuthenticationEntryPoint = jwtAuthenticationEntryPoint;
        this.jwtAccessDeniedHandler = jwtAccessDeniedHandler;
    }

    /**
     * Configuration principale de la chaîne de filtres HTTP.
     *
     * <p>Règles d'accès :
     * - /auth/** : public (login, register)
     * - GET /projects/**, GET /skills/** : public (portfolio visible sans login)
     * - /admin/** : ADMIN uniquement
     * - /actuator/health** : public (Kubernetes probes)
     * - Tout le reste : authentification requise
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
            // CSRF désactivé : on utilise JWT, pas de session/cookie
            .csrf(AbstractHttpConfigurer::disable)

            // CORS configuré via notre bean corsConfigurationSource()
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))

            // Stateless : pas de session HTTP
            // Raison : les JWTs sont self-contained, pas besoin de stocker l'état
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )

            // Règles d'autorisation par URL (extrait dans une méthode dédiée
            // pour respecter la limite Checkstyle de longueur de méthode)
            .authorizeHttpRequests(this::configureAuthorization)

            // Handlers d'erreurs HTTP : 401 pour non-authentifié, 403 pour non-autorisé
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(jwtAuthenticationEntryPoint)
                .accessDeniedHandler(jwtAccessDeniedHandler)
            )

            // Fournisseur d'authentification (BCrypt + UserDetailsService)
            .authenticationProvider(authenticationProvider())

            // Notre filtre JWT s'exécute AVANT le filtre d'auth standard de Spring
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)

            // Rate limiting encore avant (voir Javadoc de classe pour le pourquoi)
            .addFilterBefore(loginRateLimitFilter, JwtAuthenticationFilter.class)

            .build();
    }

    /**
     * Règles d'autorisation par URL, extraites de {@link #securityFilterChain}
     * pour respecter la limite Checkstyle de longueur de méthode.
     *
     * <p>Important : les routes /articles/admin* (ROLE_ADMIN) doivent être
     * déclarées AVANT les routes publiques /articles* — Spring Security
     * évalue les matchers dans l'ordre de déclaration (premier match gagnant).
     */
    private void configureAuthorization(
        AuthorizeHttpRequestsConfigurer<HttpSecurity>.AuthorizationManagerRequestMatcherRegistry auth
    ) {
        auth
            // Changement de mot de passe : doit être déclaré AVANT le permitAll de /auth/**
            // ci-dessous (premier match gagnant) — cette route exige une authentification,
            // contrairement au reste de /auth/** (login, register).
            .requestMatchers(HttpMethod.PUT, "/auth/password").authenticated()
            // Authentification publique
            .requestMatchers("/auth", "/auth/**").permitAll()
            // Portfolio public (GET seulement) - separate matchers for each pattern
            .requestMatchers(HttpMethod.GET, "/projects").permitAll()
            .requestMatchers(HttpMethod.GET, "/projects/**").permitAll()
            .requestMatchers(HttpMethod.GET, "/skills").permitAll()
            .requestMatchers(HttpMethod.GET, "/skills/**").permitAll()
            // Articles : les routes /articles/admin* (ROLE_ADMIN) doivent être déclarées
            // AVANT les routes publiques /articles* — Spring Security évalue les
            // matchers dans l'ordre de déclaration (premier match gagnant).
            .requestMatchers(HttpMethod.GET, "/articles/admin").hasRole("ADMIN")
            .requestMatchers(HttpMethod.GET, "/articles/admin/**").hasRole("ADMIN")
            .requestMatchers(HttpMethod.GET, "/articles").permitAll()
            .requestMatchers(HttpMethod.GET, "/articles/**").permitAll()
            // Expériences professionnelles : lecture publique, écriture ADMIN
            .requestMatchers(HttpMethod.GET, "/experiences").permitAll()
            .requestMatchers(HttpMethod.GET, "/experiences/**").permitAll()
            // Kubernetes probes + Prometheus scraping (Prometheus n'envoie pas de JWT)
            // Sécurité prod : à protéger par IP restriction (SG AWS) ou management.server.port séparé
            .requestMatchers("/actuator/health", "/actuator/health/**", "/actuator/info").permitAll()
            .requestMatchers("/actuator/prometheus").permitAll()
            // Swagger UI (utile pour les recruteurs)
            .requestMatchers(
                "/swagger-ui/**",
                "/swagger-ui.html",
                "/v3/api-docs/**"
            ).permitAll()
            // Admin: HTTP-level protection for write operations on /projects
            .requestMatchers(HttpMethod.POST, "/projects").hasRole("ADMIN")
            .requestMatchers(HttpMethod.PUT, "/projects/**").hasRole("ADMIN")
            .requestMatchers(HttpMethod.DELETE, "/projects/**").hasRole("ADMIN")
            .requestMatchers(HttpMethod.POST, "/articles").hasRole("ADMIN")
            .requestMatchers(HttpMethod.PUT, "/articles/**").hasRole("ADMIN")
            .requestMatchers(HttpMethod.DELETE, "/articles/**").hasRole("ADMIN")
            .requestMatchers(HttpMethod.POST, "/experiences").hasRole("ADMIN")
            .requestMatchers(HttpMethod.PUT, "/experiences/**").hasRole("ADMIN")
            .requestMatchers(HttpMethod.DELETE, "/experiences/**").hasRole("ADMIN")
            // Admin: ROLE_ADMIN uniquement
            .requestMatchers("/admin/**").hasRole("ADMIN")
            // Tout le reste : authentification requise
            .anyRequest().authenticated();
    }

    /**
     * Configuration CORS.
     *
     * <p>En dev : autorise http://localhost:4200 (Angular CLI)
     * En prod : autorise uniquement le domaine DuckDNS (via variable d'env)
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        // Origines autorisées (depuis application.properties ou variable d'env)
        configuration.setAllowedOrigins(Arrays.asList(allowedOrigins.split(",")));

        // Méthodes HTTP autorisées
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));

        // Headers autorisés dans les requêtes
        configuration.setAllowedHeaders(List.of(
            "Authorization",
            "Content-Type",
            "X-Requested-With",
            "Accept",
            "Origin"
        ));

        // Headers exposés dans les réponses (le frontend peut les lire)
        configuration.setExposedHeaders(List.of("Authorization"));

        // Autoriser les cookies/credentials cross-origin
        configuration.setAllowCredentials(true);

        // Cache de la réponse preflight OPTIONS (en secondes)
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    /**
     * Provider d'authentification qui utilise notre UserDetailsService + BCrypt.
     */
    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    /**
     * Bean AuthenticationManager exposé pour être injecté dans AuthService.
     */
    @Bean
    public AuthenticationManager authenticationManager(
        AuthenticationConfiguration config
    ) throws Exception {
        return config.getAuthenticationManager();
    }

    /**
     * Encodeur de mot de passe BCrypt.
     *
     * <p>Strength = 12 : bon équilibre sécurité/performance.
     * Chaque hash est unique grâce au salt intégré → résistant aux rainbow tables.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}
