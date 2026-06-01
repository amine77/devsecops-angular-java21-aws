import { Routes } from '@angular/router';
import { adminGuard } from '@core/guards/auth.guard';

/**
 * Routes racine de l'application.
 *
 * Stratégie de LAZY LOADING :
 * Chaque feature est chargée à la demande (loadChildren + import dynamique).
 *
 * Avantages :
 * - Bundle initial plus petit (TTI — Time To Interactive plus rapide)
 * - Le navigateur ne charge que ce dont il a besoin
 * - Idéal pour un portfolio (visiteurs consultent rarement l'admin)
 *
 * Ordre important :
 * - Les routes plus spécifiques (auth, admin) avant les routes génériques
 * - '' en dernier avec redirectTo (catch-all)
 */
export const routes: Routes = [
  {
    path: '',
    redirectTo: '/portfolio',
    pathMatch: 'full',
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'portfolio',
    loadChildren: () =>
      import('./features/portfolio/portfolio.routes').then((m) => m.portfolioRoutes),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.adminRoutes),
  },
  {
    path: 'privacy',
    loadComponent: () =>
      import('./features/legal/privacy.component').then((m) => m.PrivacyComponent),
  },
  {
    path: '**',
    redirectTo: '/portfolio',
  },
];
