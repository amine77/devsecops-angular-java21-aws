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
# maven:3.9-eclipse-temurin-21-alpine = JDK 21 + Maven 3.9 (Alpine)
# eclipse-temurin:21-jdk-alpine ne contient PAS Maven → mvn: not found
FROM maven:3.9-eclipse-temurin-21-alpine AS builder

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
# --mount=type=cache : cache BuildKit persistant pour ~/.m2 — même quand le
# pom.xml change, seuls les artefacts nouveaux/modifiés sont retéléchargés
# (sans ce mount, un changement de pom invalide la couche et retélécharge TOUT)
RUN --mount=type=cache,target=/root/.m2 mvn dependency:go-offline -B

# Copier maintenant le code source
COPY src ./src

# Compiler et packager l'application
# -DskipTests : les tests sont exécutés séparément dans le pipeline CI/CD
# -Dcheckstyle.skip=true : Checkstyle appartient au CI (job dédié), pas au build Docker
#   Raison : séparation des responsabilités — Docker produit un artefact,
#   le CI vérifie la qualité. Évite aussi les conflits Guava Maven 3.9 / Checkstyle.
# -Dspring.profiles.active=prod : profile prod pour la compilation
RUN --mount=type=cache,target=/root/.m2 mvn package -B -DskipTests -Dcheckstyle.skip=true -Dspring.profiles.active=prod

# Extraire les layers du JAR Spring Boot (optimisation cache Docker)
# Spring Boot Layered JAR sépare :
#   - dependencies (rarement modifiées)
#   - spring-boot-loader
#   - snapshot-dependencies
#   - application (notre code — souvent modifié)
# Chaque layer devient une couche Docker séparée = rebuild plus rapide
# Syntaxe Spring Boot 3.3+ : '-Djarmode=tools extract --layers --launcher'
# (l'ancienne syntaxe 'layertools' est dépréciée depuis 3.3)
RUN java -Djarmode=tools -jar target/*.jar extract --layers --launcher --destination extracted

# ===========================================================================
# STAGE 2 : RUNTIME
# Image minimale avec seulement le JRE (pas le JDK, pas Maven)
# eclipse-temurin = image officielle OpenJDK par Adoptium (recommandée par Spring)
# alpine = distribution Linux minimale (~5MB)
# ===========================================================================
FROM eclipse-temurin:24-jre-alpine AS runtime

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
# HEALTHCHECK — Sonde de santé Docker/Kubernetes
#
# wget est disponible dans eclipse-temurin:21-jre-alpine (contrairement à curl).
# On cible /actuator/health/readiness (K8s readiness probe).
# --start-period 90s : délai avant de commencer les checks (Spring Boot démarre lentement).
# =============================================================================
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
    CMD wget -q -O- http://localhost:8080/actuator/health/readiness || exit 1

# =============================================================================
# DIMENSIONNEMENT MÉMOIRE DE LA JVM
#
# Le heap n'est plus figé en dur. Raison : un "-Xmx600m" codé ici ignorait
# totalement la limite mémoire du conteneur. Sur l'EC2, le backend tourne avec
# "deploy.resources.limits.memory: 768M" — or 600 Mo de heap + 256 Mo de
# metaspace + les stacks dépassent cette limite, et c'est l'OOM killer du
# noyau qui tranchait, pas la JVM.
#
# Autre effet du codage en dur : le "JAVA_OPTS" défini dans
# docker-compose.prod.yml n'était JAMAIS lu — un ENTRYPOINT en forme exec ne
# passe pas par un shell, donc aucune variable d'environnement n'y est
# interpolée. La configuration mémoire semblait ajustable ; elle ne l'était pas.
#
# -XX:MaxRAMPercentage=65 : la JVM lit le cgroup du conteneur et prend 65 % de
#   la limite, soit ~499 Mo de heap pour 768 Mo. Changer la limite du conteneur
#   suffit désormais à redimensionner l'application.
#
#   Le budget hors heap se répartit ainsi sur les ~269 Mo restants :
#     metaspace     ~110-130 Mo observés (le plafond de 192 Mo est une borne
#                   de sécurité, pas une réservation)
#     code cache    ~40-50 Mo
#     stacks + GC + buffers directs  ~40 Mo
#   La marge est réelle mais pas confortable. À 70 % (~537 Mo de heap) elle
#   devenait négative dans le pire cas — d'où 65. La vraie confirmation se lit
#   sur "docker stats" une fois l'image déployée : si la RSS plafonne bien
#   sous 768 Mo, on peut remonter.
# -XX:InitialRAMPercentage=40 : évite au GC de redimensionner le heap pendant
#   la phase de démarrage de Spring.
# -Xss256k     : taille de stack par thread (défaut 1 Mo — 256k suffit ici et
#   compte, car les virtual threads sont activés).
# -XX:+UseG1GC : bon compromis pause/débit sur petite RAM.
# -XX:MaxMetaspaceSize=192m : borne les classes chargées (Spring en charge
#   beaucoup) pour que la metaspace n'empiète pas sur le budget du conteneur.
# -Djava.security.egd=... : /dev/urandom, évite un blocage au démarrage.
# =============================================================================
ENTRYPOINT ["java", \
    "-XX:MaxRAMPercentage=65", \
    "-XX:InitialRAMPercentage=40", \
    "-Xss256k", \
    "-XX:+UseG1GC", \
    "-XX:MaxMetaspaceSize=192m", \
    "-XX:+OptimizeStringConcat", \
    "-Djava.security.egd=file:/dev/./urandom", \
    "org.springframework.boot.loader.launch.JarLauncher"]
