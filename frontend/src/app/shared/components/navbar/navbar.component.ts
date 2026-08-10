import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  inject,
  viewChild,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import gsap from 'gsap';

import { AuthService } from '@core/services/auth.service';
import { LANGUAGES, Language, LanguageService } from '@core/services/language.service';
import { ScrollAnimationService } from '@core/animation/scroll-animation.service';
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
    <mat-toolbar class="navbar" #toolbar>
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

      <nav class="navbar__links" aria-label="Navigation principale" #navLinks>
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
        <a routerLink="/portfolio/blog" routerLinkActive="active" mat-button class="nav-link">
          {{ 'nav.blog' | translate }}
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
        <img
          class="lang-flag"
          [src]="langService.currentOption().flagSrc"
          [alt]="langService.currentOption().label"
        />
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
            <img class="lang-flag" [src]="lang.flagSrc" [alt]="lang.label" />
            <span class="lang-name">{{ lang.label }}</span>
          </button>
        }
      </mat-menu>

      <div class="navbar__actions" #actions>
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
export class NavbarComponent implements AfterViewInit, OnDestroy {
  protected readonly authService = inject(AuthService);
  protected readonly langService = inject(LanguageService);
  protected readonly languages = LANGUAGES;
  private readonly scrollAnim = inject(ScrollAnimationService);
  private readonly ngZone = inject(NgZone);

  private readonly toolbarEl = viewChild<ElementRef<HTMLElement>>('toolbar');
  private readonly navLinksEl = viewChild<ElementRef<HTMLElement>>('navLinks');
  private readonly actionsEl = viewChild<ElementRef<HTMLElement>>('actions');
  private entryTl?: gsap.core.Timeline;

  ngAfterViewInit(): void {
    if (this.scrollAnim.reducedMotion) return;
    this.animateEntry();
  }

  ngOnDestroy(): void {
    this.entryTl?.kill();
  }

  private animateEntry(): void {
    const toolbar = this.toolbarEl()?.nativeElement;
    const links = this.navLinksEl()?.nativeElement;
    const actions = this.actionsEl()?.nativeElement;
    if (!toolbar) return;

    // La navbar part de au-dessus du viewport et glisse vers le bas
    this.ngZone.runOutsideAngular(() => {
      this.entryTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      this.entryTl.from(toolbar, { y: -64, opacity: 0, duration: 0.6, delay: 0.1 });
      if (links?.children) {
        this.entryTl.from(
          Array.from(links.children) as HTMLElement[],
          { opacity: 0, y: -8, stagger: 0.07, duration: 0.4 },
          '-=0.25'
        );
      }
      if (actions) {
        this.entryTl.from(actions, { opacity: 0, x: 12, duration: 0.4 }, '-=0.3');
      }
    });
  }

  setLang(code: Language): void {
    this.langService.setLanguage(code);
  }

  logout(): void {
    this.authService.logout();
  }
}
