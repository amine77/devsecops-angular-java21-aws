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
      <div class="section container pd-error">
        <div class="pd-error__icon" aria-hidden="true">⚠</div>
        <p>{{ error() }}</p>
        <a routerLink="/portfolio/projects" class="btn btn-outline">← Retour aux projets</a>
      </div>
    } @else if (project()) {
      <!-- Hero header -->
      <div class="pd-hero">
        <div class="pd-hero__bg" aria-hidden="true"></div>
        <div class="container">
          <a routerLink="/portfolio/projects" class="pd-back">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Retour aux projets
          </a>
          <h1 class="pd-hero__title">{{ project()!.title }}</h1>
          @if (project()!.summary) {
            <p class="pd-hero__summary">{{ project()!.summary }}</p>
          }
          <div class="pd-hero__tags">
            @for (skill of project()!.skills; track skill.id) {
              <span class="badge badge-blue">{{ skill.name }}</span>
            }
          </div>
          @if (project()!.githubUrl || project()!.demoUrl) {
            <div class="pd-hero__actions">
              @if (project()!.githubUrl) {
                <a
                  [href]="project()!.githubUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn btn-primary"
                >
                  Voir sur GitHub
                </a>
              }
              @if (project()!.demoUrl) {
                <a
                  [href]="project()!.demoUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn btn-outline"
                >
                  Voir la démo →
                </a>
              }
            </div>
          }
        </div>
      </div>

      <!-- Body -->
      <div class="section pd-body">
        <div class="container pd-layout">
          @if (project()!.imageUrl) {
            <img [src]="project()!.imageUrl" [alt]="project()!.title" class="pd-image" />
          }

          <div class="pd-content card">
            <h2 class="pd-content__title">Description du projet</h2>
            <p class="pd-content__text">{{ project()!.description }}</p>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .pd-hero {
        position: relative;
        padding: var(--spacing-2xl) 0 var(--spacing-3xl);
        overflow: hidden;
        background: var(--color-bg-secondary);
        border-bottom: 1px solid var(--color-border);
      }
      .pd-hero__bg {
        position: absolute;
        inset: 0;
        background: radial-gradient(ellipse at 20% 50%, rgba(59, 130, 246, 0.08), transparent 60%);
        pointer-events: none;
      }
      .pd-back {
        display: inline-flex;
        align-items: center;
        gap: var(--spacing-xs);
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
        margin-bottom: var(--spacing-xl);
        transition: color 150ms ease;
        text-decoration: none;
      }
      .pd-back:hover {
        color: var(--color-accent);
      }
      .pd-hero__title {
        font-size: clamp(1.75rem, 4vw, 2.75rem);
        font-weight: 700;
        color: var(--color-text-primary);
        line-height: 1.2;
        margin: 0 0 var(--spacing-md);
        max-width: 720px;
      }
      .pd-hero__summary {
        font-size: var(--font-size-lg);
        color: var(--color-text-secondary);
        margin: 0 0 var(--spacing-lg);
        max-width: 640px;
        line-height: 1.7;
      }
      .pd-hero__tags {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-xs);
        margin-bottom: var(--spacing-xl);
      }
      .pd-hero__actions {
        display: flex;
        gap: var(--spacing-md);
        flex-wrap: wrap;
      }
      .pd-layout {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-xl);
        max-width: 860px;
      }
      .pd-image {
        width: 100%;
        max-height: 460px;
        object-fit: cover;
        border-radius: var(--radius-lg);
        border: 1px solid var(--color-border);
      }
      .pd-content {
        padding: var(--spacing-xl);
      }
      .pd-content__title {
        font-size: var(--font-size-xl);
        font-weight: 600;
        color: var(--color-text-primary);
        margin: 0 0 var(--spacing-lg);
      }
      .pd-content__text {
        font-size: var(--font-size-lg);
        line-height: 1.85;
        color: var(--color-text-secondary);
        white-space: pre-line;
        margin: 0;
      }
      .pd-error {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--spacing-lg);
        text-align: center;
      }
      .pd-error__icon {
        font-size: 2.5rem;
        color: var(--color-warning);
      }
    `,
  ],
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
