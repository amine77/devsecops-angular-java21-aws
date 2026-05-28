@echo off
set SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5433/portfolio_dev
set SPRING_DATASOURCE_USERNAME=portfolio_user
set SPRING_DATASOURCE_PASSWORD=portfolio_pass
set JWT_SECRET=dev-secret-key-minimum-256-bits-for-hmac-sha256-algorithm
set SPRING_PROFILES_ACTIVE=dev
set SPRING_KAFKA_LISTENER_AUTO_STARTUP=false
set SPRING_KAFKA_ADMIN_AUTO_CREATE=false
mvn spring-boot:run -f backend/pom.xml -Dspring-boot.run.profiles=dev -Dspring.kafka.producer.properties.max.block.ms=1000
