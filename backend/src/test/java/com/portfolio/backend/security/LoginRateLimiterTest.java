package com.portfolio.backend.security;

import com.portfolio.backend.security.LoginRateLimiter.Decision;
import com.portfolio.backend.security.LoginRateLimiter.Outcome;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests unitaires du limiteur de connexions.
 *
 * <p>Les fenêtres sont volontairement réduites à quelques centaines de
 * millisecondes : c'est le comportement qu'on vérifie, pas les valeurs de
 * production.
 */
@DisplayName("LoginRateLimiter — anti-brute-force et protection CPU")
class LoginRateLimiterTest {

    private static final String IP = "203.0.113.42";
    private static final String OTHER_IP = "198.51.100.7";

    private static LoginRateLimiter limiter(int maxAttempts, Duration attemptWindow,
                                            int maxFailures, Duration failureWindow) {
        return new LoginRateLimiter(true, maxAttempts, attemptWindow, maxFailures, failureWindow);
    }

    @Nested
    @DisplayName("Verrouillage après échecs répétés")
    class LockoutTests {

        @Test
        @DisplayName("Laisse passer tant que le seuil d'échecs n'est pas atteint")
        void allowsBelowFailureThreshold() {
            LoginRateLimiter limiter = limiter(100, Duration.ofMinutes(1), 5, Duration.ofMinutes(15));

            for (int i = 0; i < 4; i++) {
                assertThat(limiter.check(IP).blocked())
                    .as("tentative %d sur 4", i + 1)
                    .isFalse();
                limiter.recordFailure(IP);
            }

            assertThat(limiter.check(IP).blocked()).isFalse();
        }

        @Test
        @DisplayName("Verrouille au N-ième échec et annonce un Retry-After exploitable")
        void locksOutAtThreshold() {
            LoginRateLimiter limiter = limiter(100, Duration.ofMinutes(1), 5, Duration.ofMinutes(15));

            for (int i = 0; i < 5; i++) {
                limiter.check(IP);
                limiter.recordFailure(IP);
            }

            Decision decision = limiter.check(IP);

            assertThat(decision.outcome()).isEqualTo(Outcome.LOCKED_OUT);
            assertThat(decision.blocked()).isTrue();
            assertThat(decision.retryAfterSeconds())
                .isPositive()
                .isLessThanOrEqualTo(Duration.ofMinutes(15).toSeconds());
        }

        @Test
        @DisplayName("Une connexion réussie efface l'historique d'échecs")
        void successResetsFailureCounter() {
            LoginRateLimiter limiter = limiter(100, Duration.ofMinutes(1), 5, Duration.ofMinutes(15));

            for (int i = 0; i < 4; i++) {
                limiter.recordFailure(IP);
            }
            limiter.recordSuccess(IP);

            // Sans remise à zéro, ces 4 échecs supplémentaires (8 au total)
            // auraient largement dépassé le seuil de 5.
            for (int i = 0; i < 4; i++) {
                assertThat(limiter.check(IP).blocked()).isFalse();
                limiter.recordFailure(IP);
            }
        }

        @Test
        @DisplayName("Le verrouillage expire à la fin de la fenêtre")
        void lockoutExpiresAfterWindow() throws InterruptedException {
            LoginRateLimiter limiter = limiter(100, Duration.ofMinutes(1), 2, Duration.ofMillis(200));

            limiter.recordFailure(IP);
            limiter.recordFailure(IP);
            assertThat(limiter.check(IP).outcome()).isEqualTo(Outcome.LOCKED_OUT);

            Thread.sleep(300);

            assertThat(limiter.check(IP).blocked()).isFalse();
        }

        @Test
        @DisplayName("Le verrouillage d'une IP n'affecte pas les autres")
        void lockoutIsScopedToOneIp() {
            LoginRateLimiter limiter = limiter(100, Duration.ofMinutes(1), 2, Duration.ofMinutes(15));

            limiter.recordFailure(IP);
            limiter.recordFailure(IP);

            assertThat(limiter.check(IP).blocked()).isTrue();
            assertThat(limiter.check(OTHER_IP).blocked()).isFalse();
        }
    }

    @Nested
    @DisplayName("Plafond de débit — protection CPU contre les hashs BCrypt")
    class ThrottleTests {

        @Test
        @DisplayName("Refuse au-delà du plafond même si toutes les tentatives réussissent")
        void throttlesEvenWithoutFailures() {
            LoginRateLimiter limiter = limiter(3, Duration.ofMinutes(1), 5, Duration.ofMinutes(15));

            for (int i = 0; i < 3; i++) {
                assertThat(limiter.check(IP).blocked())
                    .as("requête %d sur 3 autorisées", i + 1)
                    .isFalse();
                limiter.recordSuccess(IP);
            }

            Decision decision = limiter.check(IP);

            assertThat(decision.outcome()).isEqualTo(Outcome.THROTTLED);
            assertThat(decision.retryAfterSeconds()).isPositive();
        }

        @Test
        @DisplayName("Le plafond n'est PAS remis à zéro par une connexion réussie")
        void successDoesNotResetThrottle() {
            LoginRateLimiter limiter = limiter(2, Duration.ofMinutes(1), 5, Duration.ofMinutes(15));

            limiter.check(IP);
            limiter.recordSuccess(IP);
            limiter.check(IP);
            limiter.recordSuccess(IP);

            // Un succès coûte exactement le même hash BCrypt qu'un échec :
            // le rendre gratuit rouvrirait le vecteur de saturation CPU.
            assertThat(limiter.check(IP).outcome()).isEqualTo(Outcome.THROTTLED);
        }

        @Test
        @DisplayName("Le plafond se réarme à la fin de la fenêtre")
        void throttleExpiresAfterWindow() throws InterruptedException {
            LoginRateLimiter limiter = limiter(1, Duration.ofMillis(200), 5, Duration.ofMinutes(15));

            assertThat(limiter.check(IP).blocked()).isFalse();
            assertThat(limiter.check(IP).outcome()).isEqualTo(Outcome.THROTTLED);

            Thread.sleep(300);

            assertThat(limiter.check(IP).blocked()).isFalse();
        }
    }

    @Nested
    @DisplayName("Interrupteur de désactivation")
    class DisabledTests {

        @Test
        @DisplayName("Désactivé, tout passe — y compris au-delà de tous les seuils")
        void disabledAllowsEverything() {
            LoginRateLimiter limiter =
                new LoginRateLimiter(false, 1, Duration.ofMinutes(1), 1, Duration.ofMinutes(15));

            for (int i = 0; i < 50; i++) {
                limiter.recordFailure(IP);
                assertThat(limiter.check(IP).outcome()).isEqualTo(Outcome.ALLOWED);
            }
        }
    }
}
