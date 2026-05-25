# =============================================================================
# DOCKERFILE BACKEND — Multi-stage build optimisé RAM pour EC2 t2.micro
# =============================================================================
#
# POURQUOI le multi-stage build ?
# → Stage 1 (builder) : contient Maven + JDK (image ~700MB) — utilisé seulement pour compiler
# → Stage 2 (runtime) : contient seulement JRE Alpine (image ~150MB) — image finale déployée
# → Résultat : image finale ~170MB au lieu de ~700MB
#
# AVANTAGES :
# - Image légère = transfert ECR → EC2 plus rapide
# - Moins de surface d'attaque (pas de Maven, pas de JDK en prod)
# - Moins de RAM consommée au démarrage
#
# =============================================================================

# ===========================================================================
# STAGE 1 : BUILD
# Utilise le JDK complet + Maven pour compiler et packager
# ===========================================================================
FROM eclipse-temurin:21-jdk-alpine AS builder

# Répertoire de travail dans le container
WORKDIR /build

# Copier d'abord le pom.xml seul (pour profiter du cache Docker)
# Raison : si le code change mais pas le pom.xml, Docker réutilise le cache
# des dépendances Maven → build beaucoup plus rapide
COPY pom.xml .
# checkstyle.xml doit être copié avec pom.xml :
# Checkstyle est lié à la phase "validate" qui s'exécute avant "compile".
# Sans ce fichier, mvn package échoue avec "Could not find resource 'checkstyle.xml'".
COPY checkstyle.xml .

# Télécharger les dépendances Maven (étape cachée séparément)
# -B : batch mode (pas d'interactivité)
# dependency:go-offline : télécharge toutes les dépendances
RUN mvn dependency:go-offline -B

# Copier maintenant le code source
COPY src ./src

# Compiler et packager l'application
# -DskipTests : les tests sont exécutés séparément dans le pipeline CI/CD
# -Dspring.profiles.active=prod : profile prod pour la compilation
RUN mvn package -B -DskipTests -Dspring.profiles.active=prod

# Extraire les layers du JAR Spring Boot (optimisation cache Docker)
# Spring Boot Layered JAR sépare :
#   - dependencies (rarement modifiées)
#   - spring-boot-loader
#   - snapshot-dependencies
#   - application (notre code — souvent modifié)
# Chaque layer devient une couche Docker séparée = rebuild plus rapide
RUN java -Djarmode=layertools -jar target/*.jar extract --destination extracted

# ===========================================================================
# STAGE 2 : RUNTIME
# Image minimale avec seulement le JRE (pas le JDK, pas Maven)
# eclipse-temurin = image officielle OpenJDK par Adoptium (recommandée par Spring)
# alpine = distribution Linux minimale (~5MB)
# ===========================================================================
FROM eclipse-temurin:21-jre-alpine AS runtime

# Métadonnées de l'image (bonne pratique)
LABEL maintainer="amine.charrad@gmail.com"
LABEL version="1.0.0"
LABEL description="Portfolio Backend — Spring Boot Java 21"

# Sécurité : créer un utilisateur non-root pour exécuter l'app
# Raison : en cas de faille, l'attaquant n'a pas les droits root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copier les layers dans l'ordre de la moins au plus souvent modifiée
# Ordre important : couche rarement modifiée = cache Docker stable
COPY --from=builder /build/extracted/dependencies/ ./
COPY --from=builder /build/extracted/spring-boot-loader/ ./
COPY --from=builder /build/extracted/snapshot-dependencies/ ./
COPY --from=builder /build/extracted/application/ ./

# Donner les droits à l'utilisateur non-root
RUN chown -R appuser:appgroup /app

# Basculer vers l'utilisateur non-root
USER appuser

# Port exposé (documentation)
EXPOSE 8080

# =============================================================================
# OPTIMISATION RAM POUR EC2 t2.micro (1GB total)
#
# Options JVM expliquées :
# -Xmx300m     : heap maximum 300MB (réserve de la RAM pour l'OS et les autres pods)
# -Xms128m     : heap initial 128MB (évite de réserver 300MB dès le démarrage)
# -Xss256k     : taille stack par thread (défaut = 1MB, 256k suffit pour la plupart)
# -XX:+UseG1GC : Garbage Collector G1 (meilleur sur petite RAM)
# -XX:MaxMetaspaceSize=128m : limite la metaspace (classes compilées)
# -XX:+OptimizeStringConcat : optimisation mineures string
# -Djava.security.egd=... : entropie pour la génération de tokens (faster startup)
# -Dspring.profiles.active=prod : active le profil prod
# =============================================================================
ENTRYPOINT ["java", \
    "-Xmx300m", \
    "-Xms128m", \
    "-Xss256k", \
    "-XX:+UseG1GC", \
    "-XX:MaxMetaspaceSize=128m", \
    "-XX:+OptimizeStringConcat", \
    "-Djava.security.egd=file:/dev/./urandom", \
    "org.springframework.boot.loader.launch.JarLauncher"]
