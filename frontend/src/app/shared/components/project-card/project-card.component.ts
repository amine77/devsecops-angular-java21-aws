import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@core/pipes/translate.pipe';

import { Project } from '@shared/models/project.model';

/**
 * Carte de projet réutilisable.
 *
 * Reçoit un projet en @Input() et l'affiche en card.
 * Utilisé dans project-list et home (featured projects).
 *
 * ChangeDetectionStrategy.OnPush :
 * Le composant ne se re-rend que si l'@Input project change (référence différente).
 * Idéal pour les listes — évite de re-rendre toutes les cards à chaque action.
 */
@Component({
  selector: 'app-project-card',
  // SlicePipe : requis explicitement dans les composants standalone
  // (pas d'import automatique comme avec NgModules + CommonModule)
  imports: [RouterLink, SlicePipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="project-card card">
      <!-- Image / placeholder -->
      <div class="project-card__image">
        @if (project.imageUrl) {
          <img [src]="project.imageUrl" [alt]="project.title" loading="lazy" />
        } @else {
          <div class="project-card__placeholder" aria-hidden="true">
            <div class="project-card__placeholder-grid"></div>
            <span class="project-card__placeholder-icon">&lt;/&gt;</span>
          </div>
        }
        @if (project.featured) {
          <span class="project-card__featured-badge">⭐ Featured</span>
        }
      </div>

      <!-- Content -->
      <div class="project-card__body">
        <h3 class="project-card__title">{{ project.title }}</h3>
        <p class="project-card__summary">
          {{ project.summary || project.description | slice: 0 : 120 }}...
        </p>

        @if (project.skills.length > 0) {
          <div class="project-card__skills">
            @for (skill of project.skills | slice: 0 : 4; track skill.id) {
              <span class="badge badge-blue">{{ skill.name }}</span>
            }
            @if (project.skills.length > 4) {
              <span class="badge badge-blue">+{{ project.skills.length - 4 }}</span>
            }
          </div>
        }

        <div class="project-card__actions">
          <a [routerLink]="['/portfolio/projects', project.id]" class="btn btn-primary btn-sm">
            Voir le projet
          </a>
          @if (project.githubUrl) {
            <a
              [href]="project.githubUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-outline btn-sm"
            >
              GitHub
            </a>
          }
          @if (project.demoUrl) {
            <a
              [href]="project.demoUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-ghost btn-sm"
            >
              Demo →
            </a>
          }
        </div>
      </div>
    </article>
  `,
  styles: [
    `
      .project-card {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        padding: 0;
        transition:
          transform 0.25s ease,
          box-shadow 0.25s ease,
          border-color 0.25s ease;
      }
      .project-card:hover {
        transform: translateY(-4px);
        box-shadow:
          0 20px 40px -12px rgba(0, 0, 0, 0.5),
          0 0 20px rgba(59, 130, 246, 0.2);
        border-color: rgba(59, 130, 246, 0.4);
      }
      .project-card__image {
        position: relative;
        height: 200px;
        overflow: hidden;
      }
      .project-card__image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.4s ease;
      }
      .project-card:hover .project-card__image img {
        transform: scale(1.06);
      }
      .project-card__placeholder {
        position: relative;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .project-card__placeholder-grid {
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(rgba(59, 130, 246, 0.07) 1px, transparent 1px),
          linear-gradient(90deg, rgba(59, 130, 246, 0.07) 1px, transparent 1px);
        background-size: 24px 24px;
      }
      .project-card__placeholder-icon {
        position: relative;
        font-family: var(--font-mono);
        font-size: 2.5rem;
        font-weight: 700;
        color: var(--color-accent);
        opacity: 0.3;
        z-index: 1;
        transition: opacity 0.25s ease;
      }
      .project-card:hover .project-card__placeholder-icon {
        opacity: 0.5;
      }
      .project-card__featured-badge {
        position: absolute;
        top: var(--spacing-sm);
        right: var(--spacing-sm);
        background: rgba(245, 158, 11, 0.15);
        color: #fbbf24;
        border: 1px solid rgba(245, 158, 11, 0.35);
        border-radius: var(--radius-full);
        font-size: var(--font-size-xs);
        font-weight: 500;
        padding: 0.2rem 0.6rem;
      }
      .project-card__body {
        flex: 1;
        padding: var(--spacing-lg);
        display: flex;
        flex-direction: column;
        gap: var(--spacing-sm);
      }
      .project-card__title {
        font-size: var(--font-size-lg);
        font-weight: 600;
        color: var(--color-text-primary);
        margin: 0;
        transition: color var(--transition-fast);
      }
      .project-card:hover .project-card__title {
        color: var(--color-accent);
      }
      .project-card__summary {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        line-height: 1.6;
        flex: 1;
        margin: 0;
      }
      .project-card__skills {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-xs);
      }
      .project-card__actions {
        display: flex;
        gap: var(--spacing-sm);
        margin-top: var(--spacing-sm);
        flex-wrap: wrap;
      }
      .btn-sm {
        padding: 0.375rem 0.875rem;
        font-size: var(--font-size-xs);
      }
    `,
  ],
})
export class ProjectCardComponent {
  @Input({ required: true }) project!: Project;
}
