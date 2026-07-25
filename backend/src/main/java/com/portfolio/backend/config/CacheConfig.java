package com.portfolio.backend.config;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.jsontype.impl.LaissezFaireSubTypeValidator;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.Cache;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import org.springframework.lang.NonNull;

import java.time.Duration;
import java.util.Map;

/**
 * Configuration du cache Redis avec Spring Cache.
 *
 * <p>Stratégie :
 * - Sérialisation JSON (lisible, survit aux redémarrages Redis)
 * - TTL par cache : 5 min pour les listes, 10 min pour les entrées individuelles
 * - Null values exclues : évite de cacher les réponses 404
 *
 * <p>Implémente {@link CachingConfigurer} pour fournir un {@link CacheErrorHandler}
 * tolérant aux pannes : voir {@link #errorHandler()}.
 */
@Configuration
@EnableCaching
public class CacheConfig implements CachingConfigurer {

    private static final Logger log = LoggerFactory.getLogger(CacheConfig.class);

    public static final String CACHE_PROJECTS = "projects";
    public static final String CACHE_PROJECTS_FEATURED = "projects-featured";
    public static final String CACHE_PROJECT = "project";

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory connectionFactory) {
        ObjectMapper cacheMapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .activateDefaultTyping(
                LaissezFaireSubTypeValidator.instance,
                ObjectMapper.DefaultTyping.EVERYTHING,
                JsonTypeInfo.As.PROPERTY
            );

        GenericJackson2JsonRedisSerializer jsonSerializer =
            new GenericJackson2JsonRedisSerializer(cacheMapper);

        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofMinutes(5))
            .serializeKeysWith(
                RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer())
            )
            .serializeValuesWith(
                RedisSerializationContext.SerializationPair.fromSerializer(jsonSerializer)
            )
            .disableCachingNullValues();

        return RedisCacheManager.builder(connectionFactory)
            .cacheDefaults(defaultConfig)
            .withInitialCacheConfigurations(Map.of(
                CACHE_PROJECT, defaultConfig.entryTtl(Duration.ofMinutes(10))
            ))
            .build();
    }

    /**
     * Gestionnaire d'erreurs de cache tolérant aux pannes.
     *
     * <p>Par défaut, Spring utilise {@code SimpleCacheErrorHandler}, qui
     * <strong>propage</strong> les exceptions Redis. Conséquence : une simple
     * indisponibilité du cache transformait {@code GET /projects} — la page
     * publique la plus visitée — en HTTP 500, alors que la donnée est
     * parfaitement disponible en base.
     *
     * <p>Le cache est une optimisation, pas une dépendance dure : en cas
     * d'erreur on logue et on laisse l'appel repartir vers PostgreSQL. Le site
     * devient plus lent, il ne tombe pas.
     *
     * <p>On ne masque pas le problème pour autant : chaque incident est tracé
     * en WARN, donc visible dans CloudWatch Logs.
     */
    @Bean
    @Override
    public CacheErrorHandler errorHandler() {
        return new CacheErrorHandler() {

            @Override
            public void handleCacheGetError(
                @NonNull RuntimeException ex, @NonNull Cache cache, @NonNull Object key
            ) {
                // Traité comme un cache miss → l'appel part en base
                log.warn("Lecture cache impossible [cache={}, key={}] : {} — repli sur la base",
                    cache.getName(), key, ex.getMessage());
            }

            @Override
            public void handleCachePutError(
                @NonNull RuntimeException ex, @NonNull Cache cache,
                @NonNull Object key, Object value
            ) {
                // La réponse est déjà calculée : on la sert sans la mémoriser
                log.warn("Écriture cache impossible [cache={}, key={}] : {}",
                    cache.getName(), key, ex.getMessage());
            }

            @Override
            public void handleCacheEvictError(
                @NonNull RuntimeException ex, @NonNull Cache cache, @NonNull Object key
            ) {
                // Cas le plus délicat : l'éviction a échoué, donc une entrée
                // périmée peut subsister jusqu'à l'expiration du TTL (5-10 min).
                // On loggue en ERROR car cela peut faire lire une donnée obsolète.
                log.error("Éviction cache impossible [cache={}, key={}] : {} "
                        + "— donnée potentiellement obsolète jusqu'au TTL",
                    cache.getName(), key, ex.getMessage());
            }

            @Override
            public void handleCacheClearError(@NonNull RuntimeException ex, @NonNull Cache cache) {
                log.error("Purge cache impossible [cache={}] : {}", cache.getName(), ex.getMessage());
            }
        };
    }
}
