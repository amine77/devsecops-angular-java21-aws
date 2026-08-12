import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@core/pipes/translate.pipe';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="section">
      <div class="container container--narrow">
        <div class="privacy-header">
          <a routerLink="/portfolio" class="back-link">{{ 'privacy.back' | translate }}</a>
          <h1 class="privacy-title">{{ 'privacy.title' | translate }}</h1>
          <p class="privacy-updated">{{ 'privacy.updated' | translate }}</p>
        </div>
        <div class="privacy-content">
          <section class="privacy-section">
            <h2>{{ 'privacy.section1.title' | translate }}</h2>
            <p>{{ 'privacy.section1.body' | translate }}</p>
            <p>
              {{ 'privacy.section1.contact' | translate }}
              <a href="mailto:contact@charrad.dev">contact@charrad.dev</a>
            </p>
          </section>
          <section class="privacy-section">
            <h2>{{ 'privacy.section2.title' | translate }}</h2>
            <p>{{ 'privacy.section2.body' | translate }}</p>
            <ul>
              <li>{{ 'privacy.section2.item1' | translate }}</li>
              <li>{{ 'privacy.section2.item2' | translate }}</li>
              <li>{{ 'privacy.section2.item3' | translate }}</li>
            </ul>
            <p>{{ 'privacy.section2.note' | translate }}</p>
          </section>
          <section class="privacy-section">
            <h2>{{ 'privacy.section3.title' | translate }}</h2>
            <table class="privacy-table">
              <thead>
                <tr>
                  <th>{{ 'privacy.table.purpose' | translate }}</th>
                  <th>{{ 'privacy.table.basis' | translate }}</th>
                  <th>{{ 'privacy.table.duration' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{{ 'privacy.table.row1.purpose' | translate }}</td>
                  <td>{{ 'privacy.table.row1.basis' | translate }}</td>
                  <td>{{ 'privacy.table.row1.duration' | translate }}</td>
                </tr>
                <tr>
                  <td>{{ 'privacy.table.row2.purpose' | translate }}</td>
                  <td>{{ 'privacy.table.row2.basis' | translate }}</td>
                  <td>{{ 'privacy.table.row2.duration' | translate }}</td>
                </tr>
                <tr>
                  <td>{{ 'privacy.table.row3.purpose' | translate }}</td>
                  <td>{{ 'privacy.table.row3.basis' | translate }}</td>
                  <td>{{ 'privacy.table.row3.duration' | translate }}</td>
                </tr>
              </tbody>
            </table>
          </section>
          <section class="privacy-section">
            <h2>{{ 'privacy.section4.title' | translate }}</h2>
            <p>{{ 'privacy.section4.body' | translate }}</p>
            <p>{{ 'privacy.section4.body2' | translate }}</p>
          </section>
          <section class="privacy-section">
            <h2>{{ 'privacy.section5.title' | translate }}</h2>
            <p>{{ 'privacy.section5.body' | translate }}</p>
            <p>
              <strong>{{ 'privacy.section5.note' | translate }}</strong>
            </p>
          </section>
          <section class="privacy-section">
            <h2>{{ 'privacy.section6.title' | translate }}</h2>
            <p>{{ 'privacy.section6.body' | translate }}</p>
          </section>
          <section class="privacy-section">
            <h2>{{ 'privacy.section7.title' | translate }}</h2>
            <p>{{ 'privacy.section7.intro' | translate }}</p>
            <ul>
              <li>{{ 'privacy.section7.right1' | translate }}</li>
              <li>{{ 'privacy.section7.right2' | translate }}</li>
              <li>{{ 'privacy.section7.right3' | translate }}</li>
              <li>{{ 'privacy.section7.right4' | translate }}</li>
              <li>{{ 'privacy.section7.right5' | translate }}</li>
              <li>{{ 'privacy.section7.right6' | translate }}</li>
            </ul>
            <p>{{ 'privacy.section7.contact' | translate }}</p>
            <p>
              {{ 'privacy.section7.cnil' | translate }}
              <a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noopener noreferrer"
                >www.cnil.fr</a
              >
            </p>
          </section>
          <section class="privacy-section">
            <h2>{{ 'privacy.section8.title' | translate }}</h2>
            <p>{{ 'privacy.section8.intro' | translate }}</p>
            <ul>
              <li>{{ 'privacy.section8.m1' | translate }}</li>
              <li>{{ 'privacy.section8.m2' | translate }}</li>
              <li>{{ 'privacy.section8.m3' | translate }}</li>
              <li>{{ 'privacy.section8.m4' | translate }}</li>
              <li>{{ 'privacy.section8.m5' | translate }}</li>
              <li>{{ 'privacy.section8.m6' | translate }}</li>
            </ul>
          </section>
          <section class="privacy-section">
            <h2>{{ 'privacy.section9.title' | translate }}</h2>
            <p>{{ 'privacy.section9.body' | translate }}</p>
          </section>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .privacy-header {
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
      .privacy-title {
        font-size: var(--font-size-3xl);
        font-weight: 700;
        color: var(--color-text-primary);
        margin: 0 0 var(--spacing-sm);
      }
      .privacy-updated {
        font-size: var(--font-size-sm);
        color: var(--color-text-muted);
        margin: 0;
      }
      .privacy-content {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-2xl);
      }
      .privacy-section h2 {
        font-size: var(--font-size-lg);
        font-weight: 600;
        color: var(--color-text-primary);
        margin: 0 0 var(--spacing-md);
        padding-bottom: var(--spacing-sm);
        border-bottom: 1px solid var(--color-border);
      }
      .privacy-section p,
      .privacy-section li {
        font-size: var(--font-size-base);
        color: var(--color-text-secondary);
        line-height: 1.7;
      }
      .privacy-section ul {
        padding-left: var(--spacing-lg);
        margin: var(--spacing-sm) 0;
      }
      .privacy-section li {
        margin-bottom: var(--spacing-xs);
      }
      .privacy-section a {
        color: var(--color-accent);
        text-decoration: none;
      }
      .privacy-section a:hover {
        text-decoration: underline;
      }
      .privacy-table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--font-size-sm);
        margin-top: var(--spacing-sm);
      }
      .privacy-table th {
        background: var(--color-bg-secondary);
        color: var(--color-text-muted);
        font-weight: 600;
        text-transform: uppercase;
        font-size: var(--font-size-xs);
        letter-spacing: 0.05em;
        padding: var(--spacing-sm) var(--spacing-md);
        text-align: left;
        border-bottom: 1px solid var(--color-border);
      }
      .privacy-table td {
        padding: var(--spacing-sm) var(--spacing-md);
        color: var(--color-text-secondary);
        border-bottom: 1px solid var(--color-border);
      }
      .privacy-table tr:last-child td {
        border-bottom: none;
      }
    `,
  ],
})
export class PrivacyComponent {}
