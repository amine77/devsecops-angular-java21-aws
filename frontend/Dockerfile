# =============================================================================
# DOCKERFILE FRONTEND — Multi-stage build Angular + NGINX
# =============================================================================
#
# Stage 1 (builder) : Node.js pour compiler Angular
#   - ng build --configuration production
#   - Tree-shaking, minification, AOT, hash dans les noms de fichiers
#   - Image ~1.2GB (jamais déployée)
#
# Stage 2 (runtime) : NGINX Alpine pour servir les fichiers statiques
#   - Copie uniquement dist/ depuis le stage builder
#   - Image finale ~25MB (NGINX Alpine très léger)
#
# Résultat :
#   - Backend Spring Boot ~170MB
#   - Frontend NGINX ~25MB
#   - Économise de la RAM sur EC2 t2.micro
# =============================================================================

# ===========================================================================
# STAGE 1 : BUILD ANGULAR
# ===========================================================================
FROM node:24-alpine AS builder

WORKDIR /build

# Copier package.json en premier (cache Docker)
# Si le code change mais pas les dépendances → npm ci réutilise le cache
COPY package.json package-lock.json ./

# npm ci (clean install) : plus déterministe que npm install
# --prefer-offline : utilise le cache si disponible (plus rapide en CI)
RUN npm ci --prefer-offline

# Copier le reste du code source
COPY . .

# Build production Angular
# --configuration production : AOT, tree-shaking, minification, hash
# Génère dist/portfolio-frontend/browser/
RUN npm run build

# ===========================================================================
# STAGE 2 : NGINX RUNTIME
# nginx:alpine = ~25MB (vs ~130MB pour nginx:latest)
# ===========================================================================
FROM nginx:1.27-alpine AS runtime

# Métadonnées
LABEL maintainer="amine.charrad@gmail.com"
LABEL version="1.0.0"
LABEL description="Portfolio Frontend — Angular 21 + NGINX"

# Supprimer la configuration NGINX par défaut
RUN rm /etc/nginx/conf.d/default.conf

# Copier notre configuration NGINX
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copier les fichiers Angular buildés depuis le stage builder
COPY --from=builder /build/dist/portfolio-frontend/browser /usr/share/nginx/html

# Sécurité : NGINX tourne en tant qu'utilisateur nginx (non-root) par défaut
# Vérifier que les fichiers sont lisibles
RUN chmod -R 755 /usr/share/nginx/html && \
    chown -R nginx:nginx /usr/share/nginx/html

# Port exposé
EXPOSE 80

# NGINX démarre en foreground (nécessaire pour Docker)
CMD ["nginx", "-g", "daemon off;"]
