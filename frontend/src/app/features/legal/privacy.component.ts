import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [RouterLink],
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
            <h2>1. Responsable du traitement</h2>
            <p>
              Ce site est un portfolio personnel développé et exploité par
              <strong>Amine Charrad</strong>, ingénieur DevSecOps.
            </p>
            <p>Contact : <a href="mailto:amine.charrad@gmail.com">amine.charrad@gmail.com</a></p>
          </section>

          <section class="privacy-section">
            <h2>2. Données collectées</h2>
            <p>Ce site collecte les données suivantes :</p>
            <ul>
              <li>
                <strong>Données de connexion</strong> : adresse e-mail et mot de passe hashé
                (BCrypt) lors de l'authentification à l'espace d'administration.
              </li>
              <li>
                <strong>Données de navigation</strong> : adresse IP, navigateur, pages consultées,
                horodatages — collectés automatiquement dans les journaux serveur (logs NGINX et
                CloudWatch).
              </li>
              <li>
                <strong>Formulaire de contact</strong> : nom, e-mail et message si vous utilisez le
                formulaire de contact.
              </li>
            </ul>
            <p>
              Aucune donnée sensible (santé, origine ethnique, convictions, etc.) n'est collectée.
            </p>
          </section>

          <section class="privacy-section">
            <h2>3. Finalités et base légale</h2>
            <table class="privacy-table">
              <thead>
                <tr>
                  <th>Finalité</th>
                  <th>Base légale</th>
                  <th>Durée de conservation</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Authentification à l'espace admin</td>
                  <td>Intérêt légitime</td>
                  <td>Durée du projet</td>
                </tr>
                <tr>
                  <td>Sécurité et journaux d'accès</td>
                  <td>Intérêt légitime</td>
                  <td>30 jours (CloudWatch)</td>
                </tr>
                <tr>
                  <td>Réponse aux messages de contact</td>
                  <td>Consentement</td>
                  <td>Jusqu'à traitement de la demande</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section class="privacy-section">
            <h2>4. Hébergement et transferts de données</h2>
            <p>
              Ce site est hébergé sur <strong>Amazon Web Services (AWS)</strong>, région
              <strong>eu-west-3 (Paris, France)</strong>. Toutes les données sont donc traitées sur
              le territoire de l'Union européenne, sans transfert vers des pays tiers.
            </p>
          </section>

          <section class="privacy-section">
            <h2>5. Cookies</h2>
            <p>
              Ce site utilise uniquement un cookie de session technique, strictement nécessaire au
              fonctionnement de l'espace d'administration (maintien de la connexion via JWT). Ce
              cookie ne nécessite pas votre consentement.
            </p>
            <p>
              <strong>Aucun cookie de tracking, de publicité ou d'analyse tiers</strong> n'est
              utilisé.
            </p>
          </section>

          <section class="privacy-section">
            <h2>6. Destinataires des données</h2>
            <p>
              Vos données ne sont ni vendues, ni cédées, ni louées à des tiers. Elles sont
              accessibles uniquement par le responsable du traitement.
            </p>
            <p>
              Les sous-traitants techniques sont : AWS (hébergement), Amazon SES (envoi d'e-mails).
              Ces prestataires agissent en tant que sous-traitants au sens du RGPD et sont soumis à
              des obligations contractuelles de confidentialité.
            </p>
          </section>

          <section class="privacy-section">
            <h2>7. Vos droits (RGPD)</h2>
            <p>
              Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez
              des droits suivants :
            </p>
            <ul>
              <li>
                <strong>Droit d'accès</strong> : obtenir une copie de vos données personnelles
              </li>
              <li><strong>Droit de rectification</strong> : corriger des données inexactes</li>
              <li><strong>Droit à l'effacement</strong> ("droit à l'oubli")</li>
              <li><strong>Droit à la limitation du traitement</strong></li>
              <li>
                <strong>Droit à la portabilité</strong> : recevoir vos données dans un format
                structuré
              </li>
              <li>
                <strong>Droit d'opposition</strong> : vous opposer au traitement de vos données
              </li>
            </ul>
            <p>
              Pour exercer ces droits, contactez-nous à :
              <a href="mailto:amine.charrad@gmail.com">amine.charrad@gmail.com</a>. Nous répondrons
              dans un délai d'un mois.
            </p>
            <p>
              Vous pouvez également introduire une réclamation auprès de la
              <strong>CNIL</strong> :
              <a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noopener noreferrer">
                www.cnil.fr
              </a>
            </p>
          </section>

          <section class="privacy-section">
            <h2>8. Sécurité des données</h2>
            <p>
              Des mesures techniques et organisationnelles sont mises en œuvre pour protéger vos
              données :
            </p>
            <ul>
              <li>Chiffrement en transit (HTTPS/TLS via Let's Encrypt)</li>
              <li>Chiffrement au repos (AWS RDS chiffré AES-256)</li>
              <li>Mots de passe hashés avec BCrypt (coût 12)</li>
              <li>Accès restreint par authentification JWT</li>
              <li>Secrets gérés via AWS Secrets Manager</li>
              <li>Audits de sécurité automatisés (OWASP ZAP, CodeQL, Trivy)</li>
            </ul>
          </section>

          <section class="privacy-section">
            <h2>9. Modifications de cette politique</h2>
            <p>
              Cette politique peut être mise à jour. La date de dernière modification est indiquée
              en haut de cette page. Les changements significatifs feront l'objet d'une information
              sur le site.
            </p>
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
