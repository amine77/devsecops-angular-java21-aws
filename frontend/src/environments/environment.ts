/**
 * Configuration de développement.
 *
 * En dev, le proxy Angular CLI (proxy.conf.json) redirige /api vers
 * localhost:8080 — pas de CORS, pas de token pour Swagger.
 */
export const environment = {
  production: false,
  apiUrl: '/api',
  appName: 'Portfolio DevSecOps',
  appVersion: '1.0.0-dev',
};
