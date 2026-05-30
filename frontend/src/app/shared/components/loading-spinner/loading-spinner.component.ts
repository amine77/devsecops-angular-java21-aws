import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Composant spinner de chargement réutilisable.
 *
 * @Input() message — texte optionnel affiché sous le spinner
 * @Input() fullPage — si true, occupe toute la hauteur visible
 */
@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="fullPage ? 'spinner-wrapper spinner-wrapper--full' : 'spinner-wrapper'">
      <div class="spinner" role="status" aria-label="Chargement en cours"></div>
      @if (message) {
        <p class="spinner-message">{{ message }}</p>
      }
    </div>
  `,
  styles: [
    `
      .spinner-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--spacing-md);
        padding: var(--spacing-2xl);

        &--full {
          min-height: calc(100vh - var(--navbar-height));
        }
      }

      .spinner-message {
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
      }
    `,
  ],
})
export class LoadingSpinnerComponent {
  @Input() message?: string;
  @Input() fullPage = false;
}
