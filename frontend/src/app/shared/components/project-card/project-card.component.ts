import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

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
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="project-card card">
      <!-- Image ou placeholder -->
      <div class="project-card__image">
        @if (project.imageUrl) {
          <img [src]="project.imageUrl" [alt]="project.title" loading="lazy" />
        } @else {
          <div class="project-card__placeholder">
            <span class="project-card__placeholder-icon">&lt;/&gt;</span>
          </div>
        }
        @if (project.featured) {
          <span class="project-card__badge badge badge-blue">⭐ Featured</span>
        }
      </div>

      <!-- Contenu -->
      <div class="project-card__body">
        <h3 class="project-card__title">{{ project.title }}</h3>
        <p class="project-card__summary">{{ project.summary || project.description | slice: 0:120 }}...</p>

        <!-- Skills tags -->
        @if (project.skills.length > 0) {
          <div class="project-card__skills">
            @for (skill of project.skills | slice: 0:4; track skill.id) {
              <span class="badge badge-blue">{{ skill.name }}</span>
            }
            @if (project.skills.length > 4) {
              <span class="badge badge-blue">+{{ project.skills.length - 4 }}</span>
            }
          </div>
        }

        <!-- Actions -->
        <div class="project-card__actions">
          <a [routerLink]="['/portfolio/projects', project.id]" class="btn btn-primary btn-sm">
            Voir le projet
          </a>
          @if (project.githubUrl) {
            <a [href]="project.githubUrl" target="_blank" rel="noopener noreferrer"
               class="btn btn-outline btn-sm">
              GitHub
            </a>
          }
          @if (project.demoUrl) {
            <a [href]="project.demoUrl" target="_blank" rel="noopener noreferrer"
               class="btn btn-ghost btn-sm">
              Demo
            </a>
          }
        </div>
      </div>
    </article>
  `,
  styles: [`
    .project-card {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      padding: 0;

      &__image {
        position: relative;
        height: 200px;
        overflow: hidden;

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform var(--transition-slow);
        }

        &:hover img { transform: scale(1.05); }
      }

      &__placeholder {
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, var(--color-bg-tertiary), var(--color-bg-secondary));
        display: flex;
        align-items: center;
        justify-content: center;
      }

      &__placeholder-icon {
        font-family: var(--font-mono);
        font-size: 2.5rem;
        color: var(--color-accent);
        opacity: 0.3;
      }

      &__badge {
        position: absolute;
        top: var(--spacing-sm);
        right: var(--spacing-sm);
      }

      &__body {
        flex: 1;
        padding: var(--spacing-lg);
        display: flex;
        flex-direction: column;
        gap: var(--spacing-sm);
      }

      &__title {
        font-size: var(--font-size-xl);
        font-weight: 600;
        color: var(--color-text-primary);
        margin: 0;
      }

      &__summary {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        line-height: 1.6;
        flex: 1;
      }

      &__skills {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-xs);
      }

      &__actions {
        display: flex;
        gap: var(--spacing-sm);
        margin-top: var(--spacing-sm);
        flex-wrap: wrap;
      }
    }

    .btn-sm {
      padding: 0.375rem 0.875rem;
      font-size: var(--font-size-xs);
    }
  `],
})
export class ProjectCardComponent {
  @Input({ required: true }) project!: Project;
}
