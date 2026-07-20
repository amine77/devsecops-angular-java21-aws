package com.portfolio.backend.loadtest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.gatling.javaapi.core.ScenarioBuilder;
import io.gatling.javaapi.core.Simulation;
import io.gatling.javaapi.http.HttpProtocolBuilder;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.UUID;

import static io.gatling.javaapi.core.CoreDsl.*;
import static io.gatling.javaapi.http.HttpDsl.*;

/**
 * Équivalent Gatling du scénario k6 {@code 03-admin-flow.js}.
 *
 * <p>Objectif : valider le flux CRUD complet d'un admin sous charge modérée.
 * Flux par itération : créer un projet → le lire → le modifier → l'archiver
 * (soft delete).
 *
 * <p>Le token JWT est obtenu une seule fois via l'override {@link #before()}
 * (équivalent du {@code setup()} k6), puis partagé entre tous les utilisateurs
 * virtuels — on évite ainsi de saturer bcrypt avec 5 logins/itération.
 *
 * <p>Profil de charge : 5 utilisateurs concurrents constants pendant 1 minute
 * (les actions admin sont rares — inutile de monter en charge).
 */
public class AdminFlowSimulation extends Simulation {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static volatile String adminToken;

    private final HttpProtocolBuilder httpProtocol = http
        .baseUrl(LoadTestConfig.BASE_URL)
        .acceptHeader("application/json")
        .contentTypeHeader("application/json")
        .userAgentHeader("Gatling/PortfolioLoadTest");

    private final ScenarioBuilder scn = scenario("Flux admin CRUD")
        .exec(session -> session
            .set("token", adminToken)
            .set("title", "[Gatling] Load Test Projet " + UUID.randomUUID()))
        .exec(
            http("POST /projects (create)")
                .post("/projects")
                .header("Authorization", "Bearer #{token}")
                .body(StringBody(session -> """
                    {"title":"%s","description":"Description E2E générée par Gatling","featured":false,"sortOrder":999,"skillIds":[]}
                    """.formatted(session.getString("title"))))
                .check(status().is(201))
                .check(jsonPath("$.data.id").saveAs("projectId"))
        )
        .pause(Duration.ofMillis(300))
        .exec(
            http("GET /projects/{id} (read)")
                .get("/projects/#{projectId}")
                .header("Authorization", "Bearer #{token}")
                .check(status().is(200))
        )
        .pause(Duration.ofMillis(300))
        .exec(
            http("PUT /projects/{id} (update)")
                .put("/projects/#{projectId}")
                .header("Authorization", "Bearer #{token}")
                .body(StringBody(session -> """
                    {"title":"%s (modifié)","description":"Description mise à jour par Gatling.","featured":false,"sortOrder":999,"skillIds":[]}
                    """.formatted(session.getString("title"))))
                .check(status().is(200))
        )
        .pause(Duration.ofMillis(300))
        .exec(
            http("DELETE /projects/{id} (archive)")
                .delete("/projects/#{projectId}")
                .header("Authorization", "Bearer #{token}")
                .check(status().is(204))
        )
        .pause(Duration.ofSeconds(1));

    {
        setUp(
            scn.injectClosed(
                constantConcurrentUsers(5).during(Duration.ofMinutes(1))
            )
        )
        .protocols(httpProtocol)
        .assertions(
            global().responseTime().percentile(95).lt(500), // CRUD plus lent que lecture seule
            global().failedRequests().percent().lt(1.0),
            global().successfulRequests().percent().gt(99.0)
        );
    }

    @Override
    public void before() {
        adminToken = fetchAdminToken();
    }

    /**
     * Authentifie l'admin en dehors du moteur Gatling (comme {@code setup()} en k6),
     * via le client HTTP du JDK — évite 5 logins bcrypt par itération.
     */
    private static String fetchAdminToken() {
        try {
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(LoadTestConfig.BASE_URL + "/auth/login"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("""
                    {"email":"%s","password":"%s"}
                    """.formatted(LoadTestConfig.ADMIN_EMAIL, LoadTestConfig.ADMIN_PASSWORD)))
                .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new IllegalStateException("Login admin échoué — statut " + response.statusCode());
            }
            JsonNode root = MAPPER.readTree(response.body());
            String token = root.path("data").path("token").asText(null);
            if (token == null || token.isBlank()) {
                throw new IllegalStateException("Token introuvable dans la réponse de login");
            }
            return token;
        } catch (Exception e) {
            throw new IllegalStateException("Impossible d'obtenir le token admin", e);
        }
    }
}
