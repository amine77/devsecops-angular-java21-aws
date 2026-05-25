package com.portfolio.backend.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Contact;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.info.License;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.annotations.servers.Server;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration de l'interface Swagger / OpenAPI 3.
 *
 * <p>Raison : une API bien documentée est essentielle pour :
 * - Les recruteurs qui testent l'API
 * - Les développeurs frontend qui consomment l'API
 * - L'intégration de futurs clients (mobile, etc.)
 *
 * <p>Accessible sur :
 * - /swagger-ui.html → Interface graphique interactive
 * - /v3/api-docs → Spécification JSON OpenAPI 3
 *
 * <p>La configuration JWT dans Swagger permet de tester les endpoints protégés
 * directement depuis l'interface (bouton "Authorize" → saisir le token).
 */
@Configuration
@OpenAPIDefinition(
    info = @Info(
        title = "Portfolio API",
        version = "1.0.0",
        description = """
            API REST du portfolio DevSecOps.

            ## Authentification
            Cette API utilise JWT (JSON Web Tokens).
            1. Appelez `POST /auth/login` avec vos credentials
            2. Copiez le `token` de la réponse
            3. Cliquez sur "Authorize" et entrez : `Bearer <votre-token>`

            ## Endpoints publics
            - `GET /projects` — Liste des projets
            - `GET /skills` — Liste des compétences
            - `POST /auth/login` — Authentification

            ## Endpoints admin (ROLE_ADMIN requis)
            - `POST /projects` — Créer un projet
            - `PUT /projects/{id}` — Modifier un projet
            - `DELETE /projects/{id}` — Supprimer un projet
            """,
        contact = @Contact(
            name = "Portfolio DevSecOps",
            email = "amine.charrad@gmail.com"
        ),
        license = @License(name = "MIT")
    ),
    servers = {
        @Server(url = "http://localhost:8080", description = "Serveur de développement"),
        @Server(url = "https://monapp.duckdns.org/api", description = "Serveur de production")
    },
    security = @SecurityRequirement(name = "bearerAuth")
)
@SecurityScheme(
    name = "bearerAuth",
    type = SecuritySchemeType.HTTP,
    scheme = "bearer",
    bearerFormat = "JWT",
    description = "Token JWT obtenu via POST /auth/login"
)
public class OpenApiConfig {
    // La configuration est entièrement déclarative via les annotations
}
