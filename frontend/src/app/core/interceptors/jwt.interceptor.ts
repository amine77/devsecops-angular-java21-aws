import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { StorageService } from '@core/services/storage.service';

/**
 * Intercepteur JWT — injecte automatiquement le token dans chaque requête HTTP.
 *
 * Angular 18 utilise les intercepteurs FONCTIONNELS (HttpInterceptorFn)
 * au lieu des classes implémentant HttpInterceptor.
 *
 * Raisons des intercepteurs fonctionnels :
 * - Tree-shakable (Angular peut les éliminer si non utilisés)
 * - Syntaxe plus simple, moins de boilerplate
 * - Compatible avec provideHttpClient(withInterceptors([...]))
 *
 * Flux :
 * 1. Chaque requête HTTP passe par cet intercepteur
 * 2. Si un token existe → clone la requête avec le header Authorization
 * 3. Sinon → laisse passer la requête inchangée
 *
 * Raison du clone() :
 * Les HttpRequest sont IMMUABLES en Angular.
 * Pour modifier une requête, on doit en créer un clone avec les changements.
 */
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const storage = inject(StorageService);
  const token = storage.getToken();

  // Si pas de token, passe la requête telle quelle (endpoints publics)
  if (!token) {
    return next(req);
  }

  // Clone la requête avec le header Authorization
  const authReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });

  return next(authReq);
};
