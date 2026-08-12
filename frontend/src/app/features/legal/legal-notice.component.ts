import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-legal-notice',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="section">
      <div class="container container--narrow">
        <div class="legal-header">
          <a routerLink="/portfolio" class="back-link">← Retour au portfolio</a>
          <h1 class="legal-title">Mentions légales</h1>
        </div>
        <div class="legal-content">
          <section class="legal-section">
            <h2>Éditeur du site</h2>
            <p>Amine Charrad — personne physique, site personnel non commercial</p>
            <p>Contact : <a href="mailto:contact@charrad.dev">contact@charrad.dev</a></p>
          </section>
          <section class="legal-section">
            <h2>Directeur de la publication</h2>
            <p>Amine Charrad</p>
          </section>
          <section class="legal-section">
            <h2>Hébergeur</h2>
            <p>Amazon Web Services EMEA SARL</p>
            <p>38 avenue John F. Kennedy, L-1855 Luxembourg</p>
          </section>
          <section class="legal-section">
            <h2>Nom de domaine</h2>
            <p>Enregistré auprès d'OVH SAS — 2 rue Kellermann, 59100 Roubaix, France</p>
          </section>
          <section class="legal-section">
            <h2>Propriété intellectuelle</h2>
            <p>
              L'ensemble du contenu de ce site (textes, code source, éléments graphiques) est la
              propriété exclusive d'Amine Charrad, sauf mention contraire. Toute reproduction totale
              ou partielle sans autorisation préalable est interdite.
            </p>
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
