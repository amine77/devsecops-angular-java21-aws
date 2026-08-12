import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@core/pipes/translate.pipe';

@Component({
  selector: 'app-legal-notice',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="section">
      <div class="container container--narrow">
        <div class="legal-header">
          <a routerLink="/portfolio" class="back-link">{{ 'legalNotice.back' | translate }}</a>
          <h1 class="legal-title">{{ 'legalNotice.title' | translate }}</h1>
        </div>
        <div class="legal-content">
          <section class="legal-section">
            <h2>{{ 'legalNotice.section1.title' | translate }}</h2>
            <p>{{ 'legalNotice.section1.body' | translate }}</p>
            <p>
              {{ 'legalNotice.section1.contact' | translate }}
              <a href="mailto:contact@charrad.dev">contact@charrad.dev</a>
            </p>
          </section>
          <section class="legal-section">
            <h2>{{ 'legalNotice.section2.title' | translate }}</h2>
            <p>{{ 'legalNotice.section2.body' | translate }}</p>
          </section>
          <section class="legal-section">
            <h2>{{ 'legalNotice.section3.title' | translate }}</h2>
            <p>{{ 'legalNotice.section3.body1' | translate }}</p>
            <p>{{ 'legalNotice.section3.body2' | translate }}</p>
          </section>
          <section class="legal-section">
            <h2>{{ 'legalNotice.section4.title' | translate }}</h2>
            <p>{{ 'legalNotice.section4.body' | translate }}</p>
          </section>
          <section class="legal-section">
            <h2>{{ 'legalNotice.section5.title' | translate }}</h2>
            <p>{{ 'legalNotice.section5.body' | translate }}</p>
          </section>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .legal-header {
        margin-bottom: var(--spacing-2xl);
      }
      .back-link {
        color: var(--color-accent);
        font-size: var(--font-size-sm);
        text-decoration: none;
        display: inline-block;
        margin-bottom: var(--spacing-lg);
        transition: opacity 150ms;
      }
      .back-link:hover {
        opacity: 0.75;
      }
      .legal-title {
        font-size: var(--font-size-3xl);
        font-weight: 700;
        color: var(--color-text-primary);
        margin: 0;
      }
      .legal-content {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-2xl);
      }
      .legal-section h2 {
        font-size: var(--font-size-lg);
        font-weight: 600;
        color: var(--color-text-primary);
        margin: 0 0 var(--spacing-md);
        padding-bottom: var(--spacing-sm);
        border-bottom: 1px solid var(--color-border);
      }
      .legal-section p {
        font-size: var(--font-size-base);
        color: var(--color-text-secondary);
        line-height: 1.7;
      }
      .legal-section a {
        color: var(--color-accent);
        text-decoration: none;
      }
      .legal-section a:hover {
        text-decoration: underline;
      }
    `,
  ],
})
export class LegalNoticeComponent {}
