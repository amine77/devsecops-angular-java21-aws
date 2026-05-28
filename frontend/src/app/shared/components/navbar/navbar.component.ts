import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';

import { AuthService } from '@core/services/auth.service';

@Component({
    selector: 'app-navbar',
    standalone: true,
    imports: [RouterLink, RouterLinkActive, MatToolbarModule, MatButtonModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <mat-toolbar class="navbar">
      <a routerLink="/portfolio" class="navbar__brand">
        <span class="navbar__logo">&lt;/&gt;</span>
        <span class="navbar__title">DevSecOps</span>
      </a>

      <nav class="navbar__links">
        <a routerLink="/portfolio" routerLinkActive="active"
           [routerLinkActiveOptions]="{ exact: true }" mat-button class="nav-link">
          Portfolio
        </a>
        <a routerLink="/portfolio/projects" routerLinkActive="active" mat-button class="nav-link">
          Projets
        </a>
        <a routerLink="/portfolio/skills" routerLinkActive="active" mat-button class="nav-link">
          Compétences
        </a>
      </nav>

      <span class="toolbar-spacer"></span>

      <div class="navbar__actions">
        @if (authService.isAuthenticated()) {
          @if (authService.isAdmin()) {
            <a routerLink="/admin" mat-stroked-button color="primary">Dashboard</a>
          }
          <button mat-button (click)="logout()">Déconnexion</button>
        } @else {
          <a routerLink="/auth/login" mat-raised-button color="primary">Connexion</a>
        }
      </div>
    </mat-toolbar>
  `,
    styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  protected readonly authService = inject(AuthService);

  logout(): void {
    this.authService.logout();
  }
}
