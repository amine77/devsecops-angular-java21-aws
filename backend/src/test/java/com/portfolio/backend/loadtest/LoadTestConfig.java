package com.portfolio.backend.loadtest;

/**
 * Configuration partagée entre les simulations Gatling.
 *
 * <p>Surchargeable via propriétés système, ex :
 * <pre>mvn gatling:test -DbaseUrl=http://staging:8080 -Dgatling.simulationClass=...</pre>
 */
final class LoadTestConfig {

    static final String BASE_URL = System.getProperty("baseUrl", "http://localhost:8080");
    static final String ADMIN_EMAIL = System.getProperty("adminEmail", "admin@portfolio.dev");
    static final String ADMIN_PASSWORD = System.getProperty("adminPassword", "Admin@2024!");

    private LoadTestConfig() {
    }
}
