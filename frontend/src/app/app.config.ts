import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';
import { jwtInterceptor } from '@core/interceptors/jwt.interceptor';
import { errorInterceptor } from '@core/interceptors/error.interceptor';

/**
 * Configuration principale de l'application Angular 21 standalone.
 *
 * Remplace le NgModule racine (AppModule) des versions précédentes.
 * Avantages de l'approche standalone :
 * - Tree-shaking plus efficace (Angular ne charge que ce qui est utilisé)
 * - Configuration explicite et centralisée
 * - Pas de NgModule à maintenir
 *
 * provideZoneChangeDetection({ eventCoalescing: true }) :
 * Regroupe plusieurs changements en un seul cycle de détection.
 * Améliore les performances.
 *
 * provideRouter(...routes) :
 * - withComponentInputBinding() : les paramètres de route sont injectés
 *   directement comme @Input() dans les composants (Angular 16+)
 * - withViewTransitions() : transitions fluides entre les pages (Angular 17+)
 *
 * provideHttpClient(withInterceptors([...])) :
 * Enregistre les intercepteurs fonctionnels dans le bon ordre :
 * 1. errorInterceptor (en dehors, attrape les erreurs de toute la chaîne)
 * 2. jwtInterceptor (ajoute le token avant l'envoi)
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideAnimations(),
    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
    provideHttpClient(withInterceptors([jwtInterceptor, errorInterceptor])),
  ],
};
