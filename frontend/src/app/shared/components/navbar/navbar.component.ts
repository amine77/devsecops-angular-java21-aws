import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '@core/services/auth.service';

/**
 * Barre de navigation fixe.
 *
 * Utilise les Signals (via authService) pour réagir aux changements d'état.
 * Avec ChangeDetectionStrategy.OnPush, le composant ne se re-rend que
 * quand les Signals changent — pas à chaque événement DOM.
 */
@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="navbar">
      <div class="navbar__container">
        <!-- Logo / Brand -->
        <a routerLink="/portfolio" class="navbar__brand">
          <span class="navbar__logo">&lt;/&gt;</span>
          <span class="navbar__title">DevSecOps</span>
        </a>

        <!-- Navigation links -->
        <ul class="navbar__links">
          <li>
            <a
              routerLink="/portfolio"
              routerLinkActive="active"
              class="navbar__link"
            >
              Portfolio
            </a>
          </li>
          <li>
            <a
              routerLink="/portfolio/projects"
              routerLinkActive="active"
              class="navbar__link"
            >
              Projets
            </a>
          </li>
          <li>
            <a
              routerLink="/portfolio/skills"
              routerLinkActive="active"
              class="navbar__link"
            >
              Compétences
            </a>
          </li>
        </ul>

        <!-- Actions utilisateur -->
        <div class="navbar__actions">
          @if (authService.isAuthenticated()) {
            @if (authService.isAdmin()) {
              <a routerLink="/admin" class="btn btn-outline btn-sm">
                Dashboard
              </a>
            }
            <button (click)="logout()" class="btn btn-ghost btn-sm">
              Déconnexion
            </button>
          } @else {
            <a routerLink="/auth/login" class="btn btn-primary btn-sm">
              Connexion
            </a>
          }
        </div>
      </div>
    </nav>
  `,
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {
  protected readonly authService = inject(AuthService);

  logout(): void {
    this.authService.logout();
  }
}
