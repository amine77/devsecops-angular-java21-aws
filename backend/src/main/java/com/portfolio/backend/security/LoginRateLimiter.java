package com.portfolio.backend.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Limiteur de tentatives de connexion, en mémoire.
 *
 * <p><b>Deux compteurs distincts, parce qu'il y a deux attaques différentes.</b>
 *
 * <p>1. <i>Verrouillage anti-brute-force</i> — {@code maxFailures} échecs par
 * fenêtre de {@code failureWindow}. Seuls les 401 consomment un jeton, et une
 * connexion réussie remet le compteur à zéro : un utilisateur légitime qui se
 * trompe deux fois puis réussit ne subit rien.
 *
 * <p>2. <i>Plafond de débit</i> — {@code maxAttempts} requêtes par fenêtre de
 * {@code attemptWindow}, succès compris. Celui-là ne protège pas les comptes
 * mais le CPU : chaque tentative de login déclenche un hash BCrypt de coût 12,
 * soit ~300 ms de calcul. Sans ce plafond, quelques centaines de requêtes par
 * minute suffisent à saturer les 2 vCPU de l'EC2 t3.small — le déni de service
 * n'a même pas besoin de deviner un mot de passe, et le verrouillage
 * ci-dessus, qui ne compte que les échecs, ne le voit pas venir.
 *
 * <p><b>Clé = adresse IP seule</b>, délibérément, et pas {@code IP + email} :
 * <ul>
 *   <li>compter par IP est plus <i>strict</i> — un attaquant qui balaie une
 *       liste d'emails depuis une IP est bloqué au 5<sup>e</sup> échec total,
 *       là où une clé {@code IP+email} lui offrirait 5 essais par email ;</li>
 *   <li>compter par email seul permettrait à n'importe qui de verrouiller le
 *       compte admin à volonté (déni de service par verrouillage) ;</li>
 *   <li>cela évite de lire le corps de la requête dans le filtre, donc de
 *       consommer le flux d'entrée avant Spring MVC.</li>
 * </ul>
 * Contrepartie assumée : plusieurs utilisateurs derrière un même NAT partagent
 * le compteur. Sans objet ici — l'application a un seul compte administrateur.
 *
 * <p><b>Pourquoi en mémoire et pas dans Redis</b> : un contrôle de sécurité ne
 * doit pas dépendre d'un service réseau faillible. Redis indisponible
 * signifierait rate limiter ouvert, exactement au moment où l'infrastructure
 * est déjà en difficulté. Le stockage local n'a qu'une limite — un
 * redémarrage du backend remet les compteurs à zéro — qu'un attaquant ne peut
 * pas provoquer à volonté. La limitation NGINX ({@code limit_req_zone} sur
 * {@code /api/auth/login}) reste active pendant ce redémarrage.
 */
public class LoginRateLimiter {

    private static final Logger log = LoggerFactory.getLogger(LoginRateLimiter.class);

    /**
     * Plafond d'IP suivies simultanément. Caffeine évince les moins récemment
     * utilisées au-delà. Sans ce plafond, un attaquant qui fait tourner les IP
     * sources ferait grossir la map jusqu'à l'OOM — le rate limiter deviendrait
     * lui-même le vecteur de déni de service.
     */
    private static final int MAX_TRACKED_CLIENTS = 100_000;

    private final Cache<String, AtomicInteger> attemptCounters;
    private final Cache<String, AtomicInteger> failureCounters;

    private final boolean enabled;
    private final int maxAttempts;
    private final Duration attemptWindow;
    private final int maxFailures;
    private final Duration failureWindow;

    public LoginRateLimiter(
        boolean enabled,
        int maxAttempts,
        Duration attemptWindow,
        int maxFailures,
        Duration failureWindow
    ) {
        this.enabled = enabled;
        this.maxAttempts = maxAttempts;
        this.attemptWindow = attemptWindow;
        this.maxFailures = maxFailures;
        this.failureWindow = failureWindow;

        // expireAfterWrite et non expireAfterAccess : la fenêtre part de la
        // PREMIÈRE tentative et ne se prolonge pas. Incrémenter l'AtomicInteger
        // ne réécrit pas l'entrée, donc un attaquant ne peut pas repousser
        // indéfiniment sa propre expiration en continuant à frapper.
        this.attemptCounters = Caffeine.newBuilder()
            .expireAfterWrite(attemptWindow)
            .maximumSize(MAX_TRACKED_CLIENTS)
            .build();

        this.failureCounters = Caffeine.newBuilder()
            .expireAfterWrite(failureWindow)
            .maximumSize(MAX_TRACKED_CLIENTS)
            .build();

        log.info("Rate limiting login : {} — {} échecs/{} puis verrouillage, {} requêtes/{} max",
            enabled ? "actif" : "DÉSACTIVÉ", maxFailures, failureWindow, maxAttempts, attemptWindow);
    }

    /**
     * Enregistre une tentative de connexion et indique si elle doit être refusée.
     *
     * <p>Appelée <b>avant</b> que la requête n'atteigne BCrypt.
     *
     * @param clientIp clé de limitation (voir {@link ClientIpResolver})
     * @return la décision, avec le délai à annoncer en {@code Retry-After}
     */
    public Decision check(String clientIp) {
        if (!enabled) {
            return Decision.allowed();
        }

        AtomicInteger failures = failureCounters.getIfPresent(clientIp);
        if (failures != null && failures.get() >= maxFailures) {
            return new Decision(Outcome.LOCKED_OUT,
                remainingSeconds(failureCounters, clientIp, failureWindow));
        }

        int attempts = attemptCounters.get(clientIp, key -> new AtomicInteger()).incrementAndGet();
        if (attempts > maxAttempts) {
            return new Decision(Outcome.THROTTLED,
                remainingSeconds(attemptCounters, clientIp, attemptWindow));
        }

        return Decision.allowed();
    }

    /** À appeler quand la tentative s'est soldée par un 401. */
    public void recordFailure(String clientIp) {
        if (!enabled) {
            return;
        }
        int failures = failureCounters.get(clientIp, key -> new AtomicInteger()).incrementAndGet();
        if (failures == maxFailures) {
            // L'IP est journalisée en clair : donnée personnelle, mais nécessaire
            // pour corréler avec les logs NGINX et alimenter une éventuelle
            // liste de blocage. La durée de rétention CloudWatch borne la conservation.
            log.warn("Verrouillage anti-brute-force : {} échecs de login depuis {} — "
                + "les tentatives suivantes sont refusées en 429 pendant {}",
                failures, clientIp, failureWindow);
        }
    }

    /**
     * À appeler après une connexion réussie : efface l'historique d'échecs.
     *
     * <p>Le plafond de débit, lui, n'est pas remis à zéro — il protège le CPU,
     * et un succès coûte exactement le même hash BCrypt qu'un échec.
     */
    public void recordSuccess(String clientIp) {
        failureCounters.invalidate(clientIp);
    }

    /**
     * Temps restant avant expiration de la fenêtre, pour l'en-tête {@code Retry-After}.
     *
     * <p>Replie sur la fenêtre complète si Caffeine ne peut pas donner l'âge de
     * l'entrée : une valeur majorée vaut mieux qu'une valeur fausse par défaut.
     */
    private long remainingSeconds(Cache<String, AtomicInteger> cache, String key, Duration window) {
        return cache.policy().expireAfterWrite()
            .flatMap(policy -> policy.ageOf(key))
            .map(age -> Math.max(1L, window.minus(age).toSeconds()))
            .orElse(window.toSeconds());
    }

    /** Nature du refus, exposée en tag Prometheus. */
    public enum Outcome {
        /** Tentative acceptée. */
        ALLOWED,
        /** Trop de requêtes en peu de temps (protection CPU). */
        THROTTLED,
        /** Trop d'échecs d'authentification (anti-brute-force). */
        LOCKED_OUT
    }

    /**
     * Verdict du limiteur.
     *
     * @param outcome            nature de la décision
     * @param retryAfterSeconds  délai à annoncer au client, 0 si autorisé
     */
    public record Decision(Outcome outcome, long retryAfterSeconds) {

        static Decision allowed() {
            return new Decision(Outcome.ALLOWED, 0L);
        }

        public boolean blocked() {
            return outcome != Outcome.ALLOWED;
        }
    }
}
