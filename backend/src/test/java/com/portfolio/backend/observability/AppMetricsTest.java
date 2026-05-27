package com.portfolio.backend.observability;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests unitaires d'AppMetrics.
 *
 * <p>Utilise SimpleMeterRegistry (en mémoire) au lieu du registry Prometheus.
 * Raison : tests sans Spring context, rapides, déterministes.
 *
 * <p>Pattern : inspecter le registry après appel → vérifier la valeur du compteur.
 */
@DisplayName("AppMetrics — Tests unitaires")
class AppMetricsTest {

    private MeterRegistry registry;
    private AppMetrics metrics;

    @BeforeEach
    void setUp() {
        registry = new SimpleMeterRegistry();
        metrics = new AppMetrics(registry);
    }

    @Nested
    @DisplayName("incrementLoginSuccess()")
    class LoginSuccessTests {

        @Test
        @DisplayName("Incrémente auth_login_success_total de 1 à chaque appel")
        void shouldIncrementByOne() {
            // WHEN
            metrics.incrementLoginSuccess();

            // THEN
            Counter counter = registry.find("auth.login.success").counter();
            assertThat(counter).isNotNull();
            assertThat(counter.count()).isEqualTo(1.0);
        }

        @Test
        @DisplayName("Incrémente correctement après plusieurs appels")
        void shouldAccumulateCorrectly() {
            // WHEN
            metrics.incrementLoginSuccess();
            metrics.incrementLoginSuccess();
            metrics.incrementLoginSuccess();

            // THEN
            assertThat(registry.find("auth.login.success").counter().count()).isEqualTo(3.0);
        }

        @Test
        @DisplayName("Le compteur est taggé result=success")
        void shouldHaveSuccessTag() {
            metrics.incrementLoginSuccess();

            Counter counter = registry.find("auth.login.success")
                .tag("result", "success")
                .counter();
            assertThat(counter).isNotNull();
            assertThat(counter.count()).isEqualTo(1.0);
        }
    }

    @Nested
    @DisplayName("incrementLoginFailure()")
    class LoginFailureTests {

        @Test
        @DisplayName("Incrémente auth_login_failure_total de 1")
        void shouldIncrementByOne() {
            // WHEN
            metrics.incrementLoginFailure();

            // THEN
            Counter counter = registry.find("auth.login.failure").counter();
            assertThat(counter).isNotNull();
            assertThat(counter.count()).isEqualTo(1.0);
        }

        @Test
        @DisplayName("Success et failure sont des compteurs indépendants")
        void shouldBeIndependentCounters() {
            // WHEN
            metrics.incrementLoginSuccess();
            metrics.incrementLoginSuccess();
            metrics.incrementLoginFailure();

            // THEN
            assertThat(registry.find("auth.login.success").counter().count()).isEqualTo(2.0);
            assertThat(registry.find("auth.login.failure").counter().count()).isEqualTo(1.0);
        }

        @Test
        @DisplayName("Le compteur est taggé result=failure")
        void shouldHaveFailureTag() {
            metrics.incrementLoginFailure();

            Counter counter = registry.find("auth.login.failure")
                .tag("result", "failure")
                .counter();
            assertThat(counter).isNotNull();
        }
    }

    @Nested
    @DisplayName("incrementHttpError()")
    class HttpErrorTests {

        @Test
        @DisplayName("Incrémente http.errors avec le bon tag status")
        void shouldIncrementWithStatusTag() {
            // WHEN
            metrics.incrementHttpError(401, "/auth/login");

            // THEN
            Counter counter = registry.find("http.errors")
                .tag("status", "401")
                .counter();
            assertThat(counter).isNotNull();
            assertThat(counter.count()).isEqualTo(1.0);
        }

        @Test
        @DisplayName("Tag status_family=4xx pour les erreurs 4xx")
        void shouldTag4xxFamily() {
            metrics.incrementHttpError(403, "/admin");

            Counter counter = registry.find("http.errors")
                .tag("status_family", "4xx")
                .counter();
            assertThat(counter).isNotNull();
        }

        @Test
        @DisplayName("Tag status_family=5xx pour les erreurs 5xx")
        void shouldTag5xxFamily() {
            metrics.incrementHttpError(500, "/api/error");

            Counter counter = registry.find("http.errors")
                .tag("status_family", "5xx")
                .counter();
            assertThat(counter).isNotNull();
        }

        @Test
        @DisplayName("Crée des séries séparées pour des codes HTTP différents")
        void shouldCreateSeparateSeriesPerStatus() {
            metrics.incrementHttpError(401, "/auth/login");
            metrics.incrementHttpError(401, "/auth/login");
            metrics.incrementHttpError(403, "/admin");

            assertThat(registry.find("http.errors").tag("status", "401").counter().count())
                .isEqualTo(2.0);
            assertThat(registry.find("http.errors").tag("status", "403").counter().count())
                .isEqualTo(1.0);
        }
    }

    @Nested
    @DisplayName("Timer — startTimer / stopTimer")
    class TimerTests {

        @Test
        @DisplayName("Enregistre une durée dans operation.duration")
        void shouldRecordDuration() throws InterruptedException {
            // WHEN
            Timer.Sample sample = metrics.startTimer();
            Thread.sleep(5); // 5ms d'opération simulée
            metrics.stopTimer(sample, "bcrypt.hash");

            // THEN
            Timer timer = registry.find("operation.duration")
                .tag("operation", "bcrypt.hash")
                .timer();
            assertThat(timer).isNotNull();
            assertThat(timer.count()).isEqualTo(1);
            assertThat(timer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS))
                .isGreaterThan(0);
        }
    }
}
