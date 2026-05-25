package com.portfolio.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Point d'entrée de l'application Spring Boot.
 *
 * <p>@SpringBootApplication est un raccourci pour :
 * - @Configuration : cette classe peut déclarer des beans
 * - @EnableAutoConfiguration : Spring Boot configure automatiquement selon le classpath
 * - @ComponentScan : Spring scanne les sous-packages pour trouver les composants
 *
 * <p>Virtual Threads (Java 21) : activés via application.properties
 * spring.threads.virtual.enabled=true
 */
@SpringBootApplication
public class BackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(BackendApplication.class, args);
    }
}
