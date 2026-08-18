import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

import { NavbarComponent } from '@shared/components/navbar/navbar.component';
import { FooterComponent } from '@shared/components/footer/footer.component';
import { BackToTopComponent } from '@shared/components/back-to-top/back-to-top.component';
import { ScrollAnimationService } from '@core/animation/scroll-animation.service';

/**
 * Composant racine de l'application.
 *
 * Responsabilité minimale : fournir la structure de page (navbar + contenu + footer).
 * La logique est dans les feature components.
 *
 * ChangeDetectionStrategy.OnPush :
 * Le composant ne se re-rend que si ses @Input() changent ou si un Signal/Observable change.
 * Raison : performance — Angular ne vérifie pas tout l'arbre de composants à chaque événement.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent, FooterComponent, BackToTopComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-navbar />
    <main class="main-content">
      <router-outlet />
    </main>
    <app-footer />
    <app-back-to-top />
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
      }

      .main-content {
        flex: 1;
        padding-top: 64px; /* Hauteur de la navbar fixe */
      }
    `,
  ],
})
export class AppComponent {
  constructor() {
    inject(ScrollAnimationService).refreshOnNavigation(inject(Router));
  }
}
