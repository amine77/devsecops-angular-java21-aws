package com.portfolio.backend.loadtest;

import io.gatling.javaapi.core.ScenarioBuilder;
import io.gatling.javaapi.core.Simulation;
import io.gatling.javaapi.http.HttpProtocolBuilder;

import java.time.Duration;

import static io.gatling.javaapi.core.CoreDsl.*;
import static io.gatling.javaapi.http.HttpDsl.*;

/**
 * Équivalent Gatling du scénario k6 {@code 02-auth-stress.js}.
 *
 * <p>Objectif : valider la résistance de {@code POST /auth/login} sous charge.
 * BCrypt (cost=12) est volontairement lent (~300ms/hash) → seuil p(95) assoupli
 * à 1500ms. Le vrai danger est la saturation du pool de connexions DB.
 *
 * <p>Profil de charge (workload fermé) :
 * <pre>
 *   0 → 20 utilisateurs concurrents en 20s   (montée)
 *   20 utilisateurs concurrents pendant 30s  (charge)
 *   20 → 50 utilisateurs concurrents en 20s  (pic de stress)
 *   50 utilisateurs concurrents pendant 30s  (stress soutenu)
 *   50 → 0 utilisateurs concurrents en 15s   (retour)
 * </pre>
 *
 * <p>~20% des itérations tentent en plus un login invalide (trafic réaliste),
 * réparti via {@code randomSwitch} — équivalent probabiliste du modulo k6
 * ({@code __ITER % 5 === 0}).
 */
public class AuthStressSimulation extends Simulation {

    private final HttpProtocolBuilder httpProtocol = http
        .baseUrl(LoadTestConfig.BASE_URL)
        .acceptHeader("application/json")
        .contentTypeHeader("application/json")
        .userAgentHeader("Gatling/PortfolioLoadTest");

    private final ScenarioBuilder scn = scenario("POST /auth/login — stress bcrypt")
        .exec(
            http("POST /auth/login (valide)")
                .post("/auth/login")
                .body(StringBody("""
                    {"email":"%s","password":"%s"}
                    """.formatted(LoadTestConfig.ADMIN_EMAIL, LoadTestConfig.ADMIN_PASSWORD)))
                .check(status().is(200))
                .check(jsonPath("$.data.token").exists())
                .check(jsonPath("$.data.expiresIn").exists())
        )
        .pause(Duration.ofSeconds(1))
        .randomSwitch().on(
            // ~20% de tentatives invalides — simule un trafic réaliste
            percent(20.0).then(
                exec(
                    http("POST /auth/login (invalide)")
                        .post("/auth/login")
                        .body(StringBody("""
                            {"email":"%s","password":"BadPassword99!"}
                            """.formatted(LoadTestConfig.ADMIN_EMAIL)))
                        .check(status().is(401))
                ).pause(Duration.ofMillis(500))
            )
        );

    {
        setUp(
            scn.injectClosed(
                rampConcurrentUsers(0).to(20).during(Duration.ofSeconds(20)),
                constantConcurrentUsers(20).during(Duration.ofSeconds(30)),
                rampConcurrentUsers(20).to(50).during(Duration.ofSeconds(20)),
                constantConcurrentUsers(50).during(Duration.ofSeconds(30)),
                rampConcurrentUsers(50).to(0).during(Duration.ofSeconds(15))
            )
        )
        .protocols(httpProtocol)
        .assertions(
            // Seuil intentionnellement souple : bcrypt est lent par design
            global().responseTime().percentile(95).lt(1500),
            global().responseTime().percentile(99).lt(3000),
            global().failedRequests().percent().lt(5.0), // tolère retries/timeouts bcrypt
            details("POST /auth/login (valide)").successfulRequests().percent().gt(95.0)
        );
    }
}
