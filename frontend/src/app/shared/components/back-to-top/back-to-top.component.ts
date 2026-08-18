import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';

const SCROLL_SHOW_THRESHOLD = 600;

/**
 * Bouton flottant "retour en haut", affiché sur toutes les pages une fois le
 * scroll suffisamment avancé.
 */
@Component({
  selector: 'app-back-to-top',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="back-to-top"
      [class.back-to-top--visible]="visible()"
      [tabindex]="visible() ? 0 : -1"
      [attr.aria-hidden]="!visible()"
      aria-label="Revenir en haut de la page"
      (click)="scrollToTop()"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        <path d="M12 5l-7 7h4v7h6v-7h4z" fill="currentColor" />
      </svg>
    </button>
  `,
  styles: [
    `
      .back-to-top {
        position: fixed;
        right: 24px;
        bottom: 24px;
        z-index: 50;
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        border-radius: var(--radius-full);
        background: var(--color-accent);
        color: #fff;
        cursor: pointer;
        box-shadow: var(--shadow-md);
        opacity: 0;
        transform: translateY(12px);
        pointer-events: none;
        transition:
          opacity 200ms ease,
          transform 200ms ease,
          background var(--transition-fast);
      }

      .back-to-top--visible {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }

      .back-to-top:hover {
        background: var(--color-accent-hover);
      }

      .back-to-top:focus-visible {
        outline: 2px solid var(--color-accent);
        outline-offset: 3px;
      }

      @media (prefers-reduced-motion: reduce) {
        .back-to-top {
          transition: none;
        }
      }
    `,
  ],
})
export class BackToTopComponent {
  protected readonly visible = signal(false);

  constructor() {
    // Lecture de window.scrollY uniquement (pas de layout reflow comme
    // getBoundingClientRect) ; le signal n'est écrit qu'au franchissement du
    // seuil, pas à chaque pixel scrollé, pour éviter tout recalcul inutile.
    const onScroll = (): void => {
      const shouldShow = window.scrollY > SCROLL_SHOW_THRESHOLD;
      if (shouldShow !== this.visible()) {
        this.visible.set(shouldShow);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    inject(DestroyRef).onDestroy(() => window.removeEventListener('scroll', onScroll));
  }

  protected scrollToTop(): void {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
  }
}
