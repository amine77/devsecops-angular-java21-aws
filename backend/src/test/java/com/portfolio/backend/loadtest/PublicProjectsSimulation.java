package com.portfolio.backend.loadtest;

import io.gatling.javaapi.core.ScenarioBuilder;
import io.gatling.javaapi.core.Simulation;
import io.gatling.javaapi.http.HttpProtocolBuilder;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;

import static io.gatling.javaapi.core.CoreDsl.*;
import static io.gatling.javaapi.http.HttpDsl.*;

/**
 * Équivalent Gatling du scénario k6 {@code 01-public-projects.js}.
 *
 * <p>SLA principal : {@code GET /projects} tient la charge à 100 utilisateurs
 * concurrents avec le cache Redis activé.
 *
 * <p>Profil de charge (workload fermé — équivalent de l'executor k6
 * {@code ramping-vus}) :
 * <pre>
 *   0 → 100 utilisateurs concurrents en 30s
 *   100 utilisateurs concurrents pendant 1m
 *   100 → 0 utilisateurs concurrents en 15s
 * </pre>
 *
 * <p>Rapport HTML généré dans {@code target/gatling/publicprojectssimulation-<timestamp>/}.
 * Lancement :
 * <pre>mvn gatling:test -Dgatling.simulationClass=com.portfolio.backend.loadtest.PublicProjectsSimulation</pre>
 */
public class PublicProjectsSimulation extends Simulation {

    private static final AtomicLong CACHE_HITS = new AtomicLong();

    private final HttpProtocolBuilder httpProtocol = http
        .baseUrl(LoadTestConfig.BASE_URL)
        .acceptHeader("application/json")
        .userAgentHeader("Gatling/PortfolioLoadTest");

    private final ScenarioBuilder scn = scenario("GET /projects — SLA public")
        .exec(
            http("GET /projects")
                .get("/projects")
                .check(status().is(200))
                .check(jsonPath("$.data.content").exists())
                .check(responseTimeInMillis().saveAs("listDurationMs"))
        )
        .exec(session -> {
            // Détection empirique du cache Redis : réponse < 20ms = hit probable
            // (même heuristique que le scénario k6 d'origine)
            if (session.getLong("listDurationMs") < 20) {
                CACHE_HITS.incrementAndGet();
            }
            return session;
        })
        .pause(Duration.ofMillis(500))
        .exec(
            http("GET /projects/featured")
                .get("/projects/featured")
                .check(status().is(200))
                .check(jsonPath("$.data").exists())
        )
        .pause(Duration.ofMillis(500))
        .exec(
            http("GET /actuator/health/readiness")
                .get("/actuator/health/readiness")
                .check(status().is(200))
        )
        .pause(Duration.ofMillis(300));

    {
        setUp(
            scn.injectClosed(
                rampConcurrentUsers(0).to(100).during(Duration.ofSeconds(30)),
                constantConcurrentUsers(100).during(Duration.ofMinutes(1)),
                rampConcurrentUsers(100).to(0).during(Duration.ofSeconds(15))
            )
        )
        .protocols(httpProtocol)
        .assertions(
            // SLA global (identique aux thresholds k6)
            global().responseTime().percentile(95).lt(200),
            global().responseTime().percentile(99).lt(500),
            global().failedRequests().percent().lt(1.0),
            global().successfulRequests().percent().gt(99.0),
            // SLA par requête
            details("GET /projects").responseTime().percentile(95).lt(200),
            details("GET /projects/featured").responseTime().percentile(95).lt(150)
        );
    }

    @Override
    public void before() {
        System.out.println("[Gatling] PublicProjectsSimulation — cible " + LoadTestConfig.BASE_URL);
    }

    @Override
    public void after() {
        System.out.println("[Gatling] Cache hits estimés (<20ms) : " + CACHE_HITS.get());
    }
}
