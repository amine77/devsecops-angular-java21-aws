import { ChangeDetectionStrategy, Component, Input, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LoadingSpinnerComponent } from '@shared/components/loading-spinner/loading-spinner.component';
import { ProjectService } from '@core/services/project.service';
import { Project } from '@shared/models/project.model';

/**
 * Détail d'un projet.
 *
 * Reçoit l'ID via @Input() grâce à withComponentInputBinding()
 * configuré dans app.config.ts.
 * Plus besoin d'injecter ActivatedRoute pour lire :id !
 */
@Component({
    selector: 'app-project-detail',
    imports: [RouterLink, LoadingSpinnerComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    @if (isLoading()) {
      <app-loading-spinner message="Chargement du projet..." [fullPage]="true" />
    } @else if (error()) {
      <div class="section container error-state">
        <p>{{ error() }}</p>
        <a routerLink="/portfolio/projects" class="btn btn-outline">← Retour aux projets</a>
      </div>
    } @else if (project()) {
      <div class="project-detail section">
        <div class="container">
          <a routerLink="/portfolio/projects" class="project-detail__back">
            ← Retour aux projets
          </a>

          <div class="project-detail__header">
            <h1>{{ project()!.title }}</h1>
            <div class="project-detail__meta">
              @for (skill of project()!.skills; track skill.id) {
                <span class="badge badge-blue">{{ skill.name }}</span>
              }
            </div>
          </div>

          @if (project()!.imageUrl) {
            <img
              [src]="project()!.imageUrl"
              [alt]="project()!.title"
              class="project-detail__image"
            />
          }

          <div class="project-detail__body">
            <p class="project-detail__description">{{ project()!.description }}</p>
          </div>

          <div class="project-detail__actions">
            @if (project()!.githubUrl) {
              <a [href]="project()!.githubUrl" target="_blank" rel="noopener noreferrer"
                 class="btn btn-primary">
                Voir sur GitHub
              </a>
            }
            @if (project()!.demoUrl) {
              <a [href]="project()!.demoUrl" target="_blank" rel="noopener noreferrer"
                 class="btn btn-outline">
                Voir la démo
              </a>
            }
          </div>
        </div>
      </div>
    }
  `,
    styles: [`
    .project-detail {
      &__back {
        display: inline-flex;
        align-items: center;
        gap: var(--spacing-xs);
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
        margin-bottom: var(--spacing-xl);
        &:hover { color: var(--color-text-primary); }
      }
      &__header {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-md);
        margin-bottom: var(--spacing-xl);
      }
      &__meta {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-xs);
      }
      &__image {
        width: 100%;
        max-height: 400px;
        object-fit: cover;
        border-radius: var(--radius-lg);
        margin-bottom: var(--spacing-xl);
        border: 1px solid var(--color-border);
      }
      &__description {
        font-size: var(--font-size-lg);
        line-height: 1.8;
        color: var(--color-text-secondary);
        white-space: pre-line;
      }
      &__actions {
        display: flex;
        gap: var(--spacing-md);
        margin-top: var(--spacing-2xl);
      }
    }
    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-lg);
      text-align: center;
    }
  `]
})
export class ProjectDetailComponent implements OnInit {
  /** Injecté depuis le param de route :id grâce à withComponentInputBinding() */
  @Input() id!: string;

  private readonly projectService = inject(ProjectService);

  protected readonly project = signal<Project | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.projectService.getProjectById(Number(this.id)).subscribe({
      next: (p) => {
        this.project.set(p);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Projet introuvable.');
        this.isLoading.set(false);
      },
    });
  }
}
