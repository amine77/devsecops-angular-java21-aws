/**
 * Scénario k6 — SLA principal : GET /projects
 *
 * Objectif : valider que le endpoint public résiste à 100 utilisateurs simultanés
 * avec un SLA p(95) < 200 ms (cache Redis activé).
 *
 * Profil de charge :
 *   0 → 100 VUs en 30s  (montée progressive)
 *   100 VUs pendant 1m  (charge soutenue)
 *   100 → 0 VUs en 15s  (descente)
 *
 * Rapport HTML : k6/reports/01-public-projects.html
 *
 * Utilisation :
 *   k6 run k6/scenarios/01-public-projects.js
 *   k6 run -e BASE_URL=http://staging:8080 k6/scenarios/01-public-projects.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { BASE_URL } from '../lib/helpers.js';

// Métriques personnalisées (visibles dans le rapport)
const projectsLatency = new Trend('projects_list_latency', true);
const featuredLatency = new Trend('projects_featured_latency', true);
const cacheHits = new Counter('cache_hit_estimated');

export const options = {
  scenarios: {
    charge_progressive: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 }, // montée à 100 users
        { duration: '1m',  target: 100 }, // charge soutenue
        { duration: '15s', target: 0   }, // descente
      ],
    },
  },

  thresholds: {
    // SLA principal : 95% des requêtes sous 200ms, 99% sous 500ms
    http_req_duration:        ['p(95)<200', 'p(99)<500'],
    // Moins de 1% d'erreurs HTTP
    http_req_failed:          ['rate<0.01'],
    // 99% des vérifications applicatives passent
    checks:                   ['rate>0.99'],
    // Métrique dédiée : p(95) de la liste des projets sous 200ms
    projects_list_latency:    ['p(95)<200'],
    // Projets featured : souvent plus rapide (petite liste cachée)
    projects_featured_latency: ['p(95)<150'],
  },
};

export default function () {
  // ── 1. GET /projects — liste paginée (endpoint principal) ──────────────────
  const listRes = http.get(`${BASE_URL}/projects`, {
    tags: { endpoint: 'projects_list' },
  });

  const listOk = check(listRes, {
    'GET /projects → 200':           (r) => r.status === 200,
    'GET /projects → success=true':  (r) => r.json('success') === true,
    'GET /projects → content array': (r) => Array.isArray(r.json('data.content')),
    'GET /projects → p95 < 200ms':   (r) => r.timings.duration < 200,
  });

  projectsLatency.add(listRes.timings.duration);

  // Détection empirique du cache Redis : réponses < 20ms = hit probable
  if (listRes.timings.duration < 20) {
    cacheHits.add(1);
  }

  sleep(0.5);

  // ── 2. GET /projects/featured — homepage (liste réduite, très cachée) ──────
  const featuredRes = http.get(`${BASE_URL}/projects/featured`, {
    tags: { endpoint: 'projects_featured' },
  });

  check(featuredRes, {
    'GET /projects/featured → 200':          (r) => r.status === 200,
    'GET /projects/featured → array':        (r) => Array.isArray(r.json('data')),
    'GET /projects/featured → p95 < 150ms':  (r) => r.timings.duration < 150,
  });

  featuredLatency.add(featuredRes.timings.duration);

  sleep(0.5);

  // ── 3. Health check — s'assure que l'app répond bien sous charge ───────────
  const healthRes = http.get(`${BASE_URL}/actuator/health/readiness`, {
    tags: { endpoint: 'health' },
  });
  check(healthRes, {
    'GET /actuator/health → UP': (r) => r.status === 200,
  });

  sleep(0.3);
}

export function handleSummary(data) {
  return {
    'k6/reports/01-public-projects.html': htmlReport(data),
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
  };
}
