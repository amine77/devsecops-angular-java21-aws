/**
 * Utilitaires partagés entre les scénarios k6.
 *
 * Variables d'environnement overridables :
 *   k6 run -e BASE_URL=http://staging:8080 scenario.js
 *   k6 run -e ADMIN_EMAIL=... -e ADMIN_PASSWORD=... scenario.js
 */

import http from 'k6/http';
import { check } from 'k6';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
export const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'admin@portfolio.dev';
export const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'Admin@2024!';

/** Authentifie l'admin et retourne le token JWT. Utilisé dans setup(). */
export function getAdminToken() {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(res, { 'setup: login admin 200': (r) => r.status === 200 });
  return res.json('data.token');
}

/** Headers JSON sans authentification. */
export function jsonHeaders() {
  return { headers: { 'Content-Type': 'application/json' } };
}

/** Headers JSON avec Bearer token. */
export function authHeaders(token) {
  return {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  };
}

/** Titre unique par VU + itération pour les tests CRUD. */
export function uniqueTitle(prefix) {
  return `[k6] ${prefix} VU${__VU}-I${__ITER}`;
}
