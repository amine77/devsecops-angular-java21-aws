import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { StorageService } from '@core/services/storage.service';

/**
 * Intercepteur de gestion globale des erreurs HTTP.
 *
 * Centralise la gestion de toutes les erreurs HTTP en un seul endroit.
 * Les composants n'ont plus besoin de gérer les 401/403/500 individuellement.
 *
 * Cas gérés :
 * - 401 Unauthorized → déconnexion automatique + redirect vers /auth/login
 * - 403 Forbidden → redirect vers page d'accès refusé
 * - 0 (réseau) → message d'erreur réseau
 * - Autres → propagation de l'erreur pour gestion locale
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const storage = inject(StorageService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      switch (error.status) {
        case 401:
          // Un 401 sur la requête de connexion elle-même veut dire « identifiants
          // refusés », pas « session expirée » : il n'y a aucune session à
          // nettoyer et le composant de login affiche déjà le bon message.
          //
          // Sans cette exclusion, chaque tentative ratée renaviguait vers
          // /auth/login en passant l'URL courante comme returnUrl — or cette
          // URL contenait déjà un returnUrl. La chaîne doublait de longueur à
          // chaque essai (observé : ~500 caractères après 6 tentatives) et
          // finissait par dépasser les limites d'URL du navigateur et les
          // tampons d'en-têtes de NGINX.
          if (req.url.includes('/auth/login')) {
            break;
          }

          // Token expiré ou invalide → nettoyer et rediriger
          storage.clear();
          void router.navigate(['/auth/login'], {
            queryParams: { returnUrl: router.url, reason: 'session_expired' },
          });
          break;

        case 403:
          // Accès refusé → rediriger vers la page d'accueil
          void router.navigate(['/']);
          break;

        case 0:
          // Erreur réseau (serveur inaccessible, pas de connexion)
          console.error('Erreur réseau — le serveur est inaccessible');
          break;
      }

      // Relance l'erreur pour que les composants puissent la gérer localement si besoin
      return throwError(() => error);
    })
  );
};
