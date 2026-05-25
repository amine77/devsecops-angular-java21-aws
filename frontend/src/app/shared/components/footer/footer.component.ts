import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="footer">
      <div class="container">
        <div class="footer__content">
          <p class="footer__text">
            Construit avec <span class="footer__heart">♥</span> par
            <strong>Amine Charrad</strong>
          </p>
          <p class="footer__stack">
            Angular · Spring Boot · Kubernetes · AWS
          </p>
        </div>
      </div>
    </footer>
  `,
  styles: [`
    .footer {
      background: var(--color-bg-secondary);
      border-top: 1px solid var(--color-border);
      padding: var(--spacing-xl) 0;
      margin-top: auto;

      &__content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--spacing-xs);
        text-align: center;
      }

      &__text {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
      }

      &__heart { color: var(--color-error); }

      &__stack {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        font-family: var(--font-mono);
      }
    }
  `],
})
export class FooterComponent {}
