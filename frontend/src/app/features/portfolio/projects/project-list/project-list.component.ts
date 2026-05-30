import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';

import { ProjectCardComponent } from '@shared/components/project-card/project-card.component';
import { LoadingSpinnerComponent } from '@shared/components/loading-spinner/loading-spinner.component';
import { ProjectService } from '@core/services/project.service';
import { PageResponse } from '@shared/models/api-response.model';
import { Project } from '@shared/models/project.model';

/**
 * Liste paginée de tous les projets actifs.
 *
 * Gère la pagination côté frontend via les méthodes nextPage/prevPage
 * qui rappellent l'API avec les bons paramètres.
 */
@Component({
    selector: 'app-project-list',
    imports: [ProjectCardComponent, LoadingSpinnerComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div class="section projects-page">
      <div class="container">

        <!-- Page header -->
        <div class="projects-header">
          <div>
            <h1 class="section-title" style="text-align:left; margin-bottom: 0.5rem">Mes projets</h1>
            <p class="section-subtitle" style="text-align:left; margin-bottom: 0">
              Applications cloud native · Infrastructure as Code · DevSecOps
            </p>
          </div>
          @if (pageData() && !isLoading()) {
            <span class="projects-count badge badge-blue">
              {{ pageData()!.totalElements }} projet{{ pageData()!.totalElements > 1 ? 's' : '' }}
            </span>
          }
        </div>

        @if (isLoading()) {
          <app-loading-spinner message="Chargement des projets..." [fullPage]="true" />
        } @else if (error()) {
          <div class="error-state">
            <div class="error-state__icon" aria-hidden="true">⚠</div>
            <p>{{ error() }}</p>
            <button class="btn btn-outline" (click)="loadProjects()">Réessayer</button>
          </div>
        } @else {
          <div class="grid-projects">
            @for (project of pageData()?.content ?? []; track project.id) {
              <app-project-card [project]="project" />
            } @empty {
              <div class="empty-state">
                <p>Aucun projet pour le moment.</p>
              </div>
            }
          </div>

          @if (pageData() && pageData()!.totalPages > 1) {
            <nav class="pagination" aria-label="Pagination des projets">
              <button class="btn btn-ghost" [disabled]="pageData()!.first" (click)="prevPage()">
                ← Précédent
              </button>
              <span class="pagination__info">
                Page {{ (pageData()?.page ?? 0) + 1 }} / {{ pageData()?.totalPages }}
              </span>
              <button class="btn btn-ghost" [disabled]="pageData()!.last" (click)="nextPage()">
                Suivant →
              </button>
            </nav>
          }
        }

      </div>
    </div>
  `,
    styles: [`
    .projects-header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      margin-bottom: var(--spacing-2xl);
      gap: var(--spacing-md);
    }
    .projects-count {
      font-family: var(--font-mono);
      font-size: var(--font-size-sm);
      padding: 0.375rem 0.875rem;
      flex-shrink: 0;
    }
    .error-state {
      text-align: center;
      padding: var(--spacing-3xl);
      color: var(--color-text-secondary);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-md);
    }
    .error-state__icon {
      font-size: 2.5rem;
      color: var(--color-warning);
    }
    .empty-state {
      text-align: center;
      padding: var(--spacing-3xl);
      color: var(--color-text-secondary);
    }
    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-lg);
      margin-top: var(--spacing-2xl);
    }
    .pagination__info {
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      font-family: var(--font-mono);
    }
    @media (max-width: 640px) {
      .projects-header { flex-direction: column; align-items: flex-start; }
    }
  `]
})
export class ProjectListComponent implements OnInit {
  private readonly projectService = inject(ProjectService);

  protected readonly pageData = signal<PageResponse<Project> | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);

  private currentPage = 0;

  ngOnInit(): void {
    this.loadProjects();
  }

  protected loadProjects(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.projectService.getProjects(this.currentPage).subscribe({
      next: (data) => {
        this.pageData.set(data);
        this.isLoading.set(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: () => {
        this.error.set('Impossible de charger les projets.');
        this.isLoading.set(false);
      },
    });
  }

  protected nextPage(): void {
    this.currentPage++;
    this.loadProjects();
  }

  protected prevPage(): void {
    this.currentPage--;
    this.loadProjects();
  }
}
