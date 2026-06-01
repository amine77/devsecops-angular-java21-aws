import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';

import { AuthService } from '@core/services/auth.service';
import { LANGUAGES, Language, LanguageService } from '@core/services/language.service';
import { TranslatePipe } from '@core/pipes/translate.pipe';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatMenuModule,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-toolbar class="navbar">
      <a routerLink="/portfolio" class="navbar__brand">
        <span class="navbar__shield" aria-hidden="true">
          <svg width="20" height="22" viewBox="0 0 20 22" fill="none">
            <path
              d="M10 1L2 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5L10 1z"
              fill="rgba(59,130,246,0.18)"
              stroke="#3b82f6"
              stroke-width="1.5"
              stroke-linejoin="round"
            />
            <path
              d="M7 11l2 2 4-4"
              stroke="#3b82f6"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        <span class="navbar__title">DevSecOps</span>
      </a>

      <nav class="navbar__links" aria-label="Navigation principale">
        <a
          routerLink="/portfolio"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: true }"
          mat-button
          class="nav-link"
        >
          {{ 'nav.portfolio' | translate }}
        </a>
        <a routerLink="/portfolio/projects" routerLinkActive="active" mat-button class="nav-link">
          {{ 'nav.projects' | translate }}
        </a>
        <a routerLink="/portfolio/skills" routerLinkActive="active" mat-button class="nav-link">
          {{ 'nav.skills' | translate }}
        </a>
      </nav>

      <span class="toolbar-spacer"></span>

      <!-- Sélecteur de langue -->
      <div
        class="lang-selector"
        [matMenuTriggerFor]="langMenu"
        role="button"
        tabindex="0"
        aria-label="Changer la langue"
      >
        <span class="lang-flag">{{ langService.currentOption().flag }}</span>
        <span class="lang-code">{{ langService.current().toUpperCase() }}</span>
        <span class="lang-arrow" aria-hidden="true">▾</span>
      </div>

      <mat-menu #langMenu="matMenu" class="lang-menu">
        @for (lang of languages; track lang.code) {
          <button
            mat-menu-item
            (click)="setLang(lang.code)"
            [class.lang-active]="lang.code === langService.current()"
          >
            <span class="lang-flag">{{ lang.flag }}</span>
            <span>{{ lang.label }}</span>
          </button>
        }
      </mat-menu>

      <div class="navbar__actions">
        @if (authService.isAuthenticated()) {
          @if (authService.isAdmin()) {
            <a routerLink="/admin" mat-stroked-button color="primary">
              {{ 'nav.dashboard' | translate }}
            </a>
          }
          <button mat-button (click)="logout()">{{ 'nav.logout' | translate }}</button>
        } @else {
          <a routerLink="/auth/login" mat-raised-button color="primary">
            {{ 'nav.login' | translate }}
          </a>
        }
      </div>
    </mat-toolbar>
  `,
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {
  protected readonly authService = inject(AuthService);
  protected readonly langService = inject(LanguageService);
  protected readonly languages = LANGUAGES;

  setLang(code: Language): void {
    this.langService.setLanguage(code);
  }

  logout(): void {
    this.authService.logout();
  }
}
