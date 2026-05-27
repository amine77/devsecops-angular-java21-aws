/**
 * Scénario k6 — Flux admin authentifié (CRUD complet)
 *
 * Objectif : valider le parcours complet d'un admin sous charge modérée.
 * Flux par itération : login → créer projet → lire projet → supprimer projet
 *
 * setup() : récupère le token admin une seule fois pour tous les VUs.
 * teardown() : nettoyage éventuel.
 *
 * Profil de charge :
 *   5 VUs constants pendant 1 minute
 *   (les actions admin sont rares — inutile de tester 100 VUs)
 *
 * Rapport HTML : k6/reports/03-admin-flow.html
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import {
  BASE_URL,
  getAdminToken,
  authHeaders,
  uniqueTitle,
} from '../lib/helpers.js';

export const options = {
  scenarios: {
    admin_crud: {
      executor: 'constant-vus',
      vus: 5,
      duration: '1m',
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<500'],   // CRUD plus lent que lecture seule
    http_req_failed:   ['rate<0.01'],
    checks:            ['rate>0.99'],
  },
};

/** Appelé une seule fois avant tous les VUs. Retourne le token partagé. */
export function setup() {
  return { token: getAdminToken() };
}

export default function ({ token }) {
  const title = uniqueTitle('Load Test Projet');
  const headers = authHeaders(token);

  // ── 1. Créer un projet ──────────────────────────────────────────────────────
  const createRes = http.post(
    `${BASE_URL}/projects`,
    JSON.stringify({
      title,
      description: `Description E2E générée par k6 — VU ${__VU} itération ${__ITER}`,
      featured: false,
      sortOrder: 999,
      skillIds: [],
    }),
    { ...headers, tags: { operation: 'create' } },
  );

  check(createRes, {
    'POST /projects → 201':    (r) => r.status === 201,
    'POST /projects → id set': (r) => !!r.json('data.id'),
  });

  const projectId = createRes.json('data.id');
  if (!projectId) {
    console.error(`[VU${__VU}] Création échouée — statut ${createRes.status}`);
    sleep(1);
    return;
  }

  sleep(0.3);

  // ── 2. Lire le projet créé ──────────────────────────────────────────────────
  const getRes = http.get(
    `${BASE_URL}/projects/${projectId}`,
    { ...headers, tags: { operation: 'read' } },
  );

  check(getRes, {
    'GET /projects/{id} → 200':    (r) => r.status === 200,
    'GET /projects/{id} → titre':  (r) => r.json('data.title') === title,
  });

  sleep(0.3);

  // ── 3. Modifier le projet ───────────────────────────────────────────────────
  const updateRes = http.put(
    `${BASE_URL}/projects/${projectId}`,
    JSON.stringify({
      title: `${title} (modifié)`,
      description: 'Description mise à jour par k6 load test.',
      featured: false,
      sortOrder: 999,
      skillIds: [],
    }),
    { ...headers, tags: { operation: 'update' } },
  );

  check(updateRes, {
    'PUT /projects/{id} → 200': (r) => r.status === 200,
  });

  sleep(0.3);

  // ── 4. Archiver (soft delete) le projet de test ─────────────────────────────
  const deleteRes = http.del(
    `${BASE_URL}/projects/${projectId}`,
    null,
    { ...headers, tags: { operation: 'delete' } },
  );

  check(deleteRes, {
    'DELETE /projects/{id} → 204': (r) => r.status === 204,
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'k6/reports/03-admin-flow.html': htmlReport(data),
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
  };
}
