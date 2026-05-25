/**
 * Configuration de production.
 *
 * En prod, apiUrl = '/api' car l'Ingress NGINX route :
 *   /api/* → Spring Boot pod
 *   /*     → Angular pod (NGINX)
 *
 * Même domaine → pas de CORS.
 */
export const environment = {
  production: true,
  apiUrl: '/api',
  appName: 'Portfolio DevSecOps',
  appVersion: '1.0.0',
};
