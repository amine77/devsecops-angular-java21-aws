import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="footer">
      <div class="container">
        <div class="footer__grid">
          <!-- Brand -->
          <div class="footer__brand">
            <div class="footer__logo" aria-hidden="true">
              <svg width="20" height="22" viewBox="0 0 20 22" fill="none">
                <path
                  d="M10 1L2 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5L10 1z"
                  fill="rgba(59,130,246,0.15)"
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
            </div>
            <p class="footer__brand-name">DevSecOps Portfolio</p>
            <p class="footer__brand-sub">16 phases · Angular 20 · Java 21 · AWS</p>
          </div>

          <!-- Stack -->
          <div class="footer__col">
            <p class="footer__col-title">Stack</p>
            <ul class="footer__list">
              <li>Angular 20 + Material 3</li>
              <li>Spring Boot · Java 21</li>
              <li>PostgreSQL · Redis · Kafka</li>
              <li>Docker · Kubernetes · Helm</li>
              <li>Terraform · AWS eu-west-3</li>
            </ul>
          </div>

          <!-- DevSecOps -->
          <div class="footer__col">
            <p class="footer__col-title">DevSecOps</p>
            <ul class="footer__list">
              <li>GitHub Actions CI/CD</li>
              <li>SonarCloud · OWASP ZAP</li>
              <li>SBOM CycloneDX · Cosign</li>
              <li>Prometheus · Grafana</li>
              <li>k6 · Cypress · JUnit 5</li>
            </ul>
          </div>
        </div>

        <div class="footer__bottom">
          <p class="footer__copy">
            Construit avec <span class="footer__heart">♥</span> par <strong>Amine Charrad</strong> —
            2026
          </p>
          <div class="footer__social">
            <a
              href="https://github.com/amine77/devsecops-angular-java21-aws-25-05-2026"
              target="_blank"
              rel="noopener noreferrer"
              class="footer__social-link"
              aria-label="GitHub du projet"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"
                />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  `,
  styles: [
    `
      .footer {
        background: var(--color-bg-secondary);
        border-top: 1px solid var(--color-border);
        padding: var(--spacing-2xl) 0 var(--spacing-lg);
        margin-top: auto;
      }
      .footer__grid {
        display: grid;
        grid-template-columns: 2fr 1fr 1fr;
        gap: var(--spacing-2xl);
        padding-bottom: var(--spacing-xl);
        border-bottom: 1px solid var(--color-border);
        margin-bottom: var(--spacing-lg);
      }
      .footer__brand {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-sm);
      }
      .footer__logo {
        display: flex;
        align-items: center;
        filter: drop-shadow(0 0 5px rgba(59, 130, 246, 0.35));
      }
      .footer__brand-name {
        font-weight: 700;
        font-size: var(--font-size-base);
        color: var(--color-text-primary);
        font-family: var(--font-mono);
        margin: 0;
      }
      .footer__brand-sub {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        font-family: var(--font-mono);
        margin: 0;
      }
      .footer__col-title {
        font-size: var(--font-size-xs);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-text-muted);
        margin: 0 0 var(--spacing-sm);
      }
      .footer__list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .footer__list li {
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
        font-family: var(--font-mono);
      }
      .footer__bottom {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .footer__copy {
        font-size: var(--font-size-sm);
        color: var(--color-text-muted);
        margin: 0;
      }
      .footer__heart {
        color: #ef4444;
      }
      .footer__social {
        display: flex;
        gap: var(--spacing-md);
      }
      .footer__social-link {
        color: var(--color-text-muted);
        transition: color 150ms ease;
        display: flex;
        align-items: center;
      }
      .footer__social-link:hover {
        color: var(--color-text-primary);
      }
      @media (max-width: 768px) {
        .footer__grid {
          grid-template-columns: 1fr;
          gap: var(--spacing-xl);
        }
        .footer__bottom {
          flex-direction: column;
          gap: var(--spacing-sm);
          text-align: center;
        }
      }
    `,
  ],
})
export class FooterComponent {}
