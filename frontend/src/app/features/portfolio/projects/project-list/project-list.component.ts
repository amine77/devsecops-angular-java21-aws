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
  standalone: true,
  imports: [ProjectCardComponent, LoadingSpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="section">
      <div class="container">
        <h1 class="section-title">Mes projets</h1>
        <p class="section-subtitle">
          Tous mes projets — du développement à l'infrastructure
        </p>

        @if (isLoading()) {
          <app-loading-spinner message="Chargement des projets..." [fullPage]="true" />
        } @else if (error()) {
          <div class="error-state">
            <p>{{ error() }}</p>
            <button class="btn btn-outline" (click)="loadProjects()">Réessayer</button>
          </div>
        } @else {
          <div class="grid-projects">
            @for (project of pageData()?.content ?? []; track project.id) {
              <app-project-card [project]="project" />
            } @empty {
              <p class="empty-message">Aucun projet pour le moment.</p>
            }
          </div>

          <!-- Pagination -->
          @if (pageData() && pageData()!.totalPages > 1) {
            <nav class="pagination" aria-label="Pagination des projets">
              <button
                class="btn btn-ghost"
                [disabled]="pageData()!.first"
                (click)="prevPage()"
              >
                ← Précédent
              </button>
              <span class="pagination__info">
                Page {{ (pageData()?.page ?? 0) + 1 }} / {{ pageData()?.totalPages }}
              </span>
              <button
                class="btn btn-ghost"
                [disabled]="pageData()!.last"
                (click)="nextPage()"
              >
                Suivant →
              </button>
            </nav>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .error-state, .empty-message {
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
      &__info {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
      }
    }
  `],
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
