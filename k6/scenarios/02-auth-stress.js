/**
 * Scénario k6 — Stress test : POST /auth/login
 *
 * Objectif : valider la résistance du login sous charge.
 * Particularité : bcrypt (cost=12) est volontairement lent → seuil p(95) = 1000ms.
 * Le vrai danger : saturation du pool de threads ou du pool de connexions DB.
 *
 * Profil de charge :
 *   0 → 20 VUs en 20s   (montée)
 *   20 VUs pendant 30s  (charge)
 *   20 → 50 VUs en 20s  (pic)
 *   50 VUs pendant 30s  (stress)
 *   50 → 0 VUs en 15s   (retour)
 *
 * Rapport HTML : k6/reports/02-auth-stress.html
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, jsonHeaders } from '../lib/helpers.js';

const loginSuccessRate = new Rate('login_success_rate');
const loginFailureRate = new Rate('login_failure_rate');

export const options = {
  scenarios: {
    stress_login: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 20 },  // montée
        { duration: '30s', target: 20 },  // warm
        { duration: '20s', target: 50 },  // pic de stress
        { duration: '30s', target: 50 },  // stress soutenu
        { duration: '15s', target: 0  },  // retour
      ],
    },
  },

  thresholds: {
    // bcrypt = lent par design → seuil plus souple
    http_req_duration:  ['p(95)<1500', 'p(99)<3000'],
    http_req_failed:    ['rate<0.05'],   // tolère 5% (retries, timeouts bcrypt)
    login_success_rate: ['rate>0.95'],   // 95% des logins réussissent
  },
};

export default function () {
  // ── Login réussi ────────────────────────────────────────────────────────────
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    { ...jsonHeaders(), tags: { scenario: 'auth_stress', type: 'valid_login' } },
  );

  const isSuccess = check(loginRes, {
    'POST /auth/login → 200':          (r) => r.status === 200,
    'POST /auth/login → token présent': (r) => !!r.json('data.token'),
    'POST /auth/login → expiresIn':    (r) => r.json('data.expiresIn') > 0,
  });

  loginSuccessRate.add(isSuccess);

  sleep(1);

  // ── Login avec mauvais mot de passe (simule des tentatives invalides) ────────
  // Charge réaliste : ~20% de tentatives invalides en production
  if (__ITER % 5 === 0) {
    const failRes = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ email: ADMIN_EMAIL, password: 'BadPassword99!' }),
      { ...jsonHeaders(), tags: { scenario: 'auth_stress', type: 'invalid_login' } },
    );

    check(failRes, {
      'POST /auth/login invalide → 401': (r) => r.status === 401,
    });

    loginFailureRate.add(failRes.status === 401 ? 1 : 0);

    sleep(0.5);
  }
}

export function handleSummary(data) {
  return {
    'k6/reports/02-auth-stress.html': htmlReport(data),
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
  };
}
