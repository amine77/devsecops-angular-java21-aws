import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '@core/services/auth.service';

/**
 * Guard fonctionnel de protection des routes authentifiées.
 *
 * Angular 18 préfère les guards FONCTIONNELS (CanActivateFn)
 * aux classes implémentant CanActivate.
 *
 * Raison : même logique de simplification que les intercepteurs.
 *
 * Protège les routes /admin/* :
 * - Si authentifié → laisse passer
 * - Si non authentifié → redirect vers /auth/login avec returnUrl
 *   (après login, l'utilisateur est redirigé vers sa destination initiale)
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Redirige avec l'URL de retour pour reprendre après le login
  void router.navigate(['/auth/login'], {
    queryParams: { returnUrl: state.url },
  });
  return false;
};

/**
 * Guard pour les routes ADMIN uniquement.
 */
export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAdmin()) {
    return true;
  }

  if (!authService.isAuthenticated()) {
    void router.navigate(['/auth/login'], {
      queryParams: { returnUrl: state.url },
    });
  } else {
    // Authentifié mais pas admin
    void router.navigate(['/']);
  }
  return false;
};
