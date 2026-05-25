import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LoadingSpinnerComponent } from '@shared/components/loading-spinner/loading-spinner.component';
import { ProjectService } from '@core/services/project.service';
import { AuthService } from '@core/services/auth.service';
import { Project } from '@shared/models/project.model';

/**
 * Dashboard d'administration.
 * Liste les projets avec des actions CRUD.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, LoadingSpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="section">
      <div class="container">
        <div class="dashboard__header">
          <div>
            <h1>Dashboard Admin</h1>
            <p>Bienvenue, {{ authService.displayName() }}</p>
          </div>
          <a routerLink="/admin/projects/new" class="btn btn-primary">
            + Nouveau projet
          </a>
        </div>

        @if (isLoading()) {
          <app-loading-spinner />
        } @else {
          <div class="dashboard__table-wrapper">
            <table class="dashboard__table">
              <thead>
                <tr>
                  <th>Titre</th>
                  <th>Statut</th>
                  <th>Featured</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (project of projects(); track project.id) {
                  <tr>
                    <td>{{ project.title }}</td>
                    <td>
                      <span [class]="'badge ' + (project.status === 'ACTIVE' ? 'badge-green' : 'badge-orange')">
                        {{ project.status }}
                      </span>
                    </td>
                    <td>{{ project.featured ? '⭐' : '—' }}</td>
                    <td class="dashboard__actions">
                      <a [routerLink]="['/admin/projects', project.id, 'edit']"
                         class="btn btn-ghost btn-sm">
                        Modifier
                      </a>
                      <button
                        class="btn btn-ghost btn-sm btn-danger"
                        (click)="deleteProject(project.id)"
                      >
                        Archiver
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="4" class="dashboard__empty">Aucun projet.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .dashboard {
      &__header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: var(--spacing-2xl);
        p { margin-top: var(--spacing-xs); }
      }
      &__table-wrapper {
        overflow-x: auto;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
      }
      &__table {
        width: 100%;
        border-collapse: collapse;
        th, td {
          padding: var(--spacing-md) var(--spacing-lg);
          text-align: left;
          font-size: var(--font-size-sm);
        }
        th {
          background: var(--color-bg-secondary);
          color: var(--color-text-secondary);
          font-weight: 500;
          border-bottom: 1px solid var(--color-border);
        }
        td { border-bottom: 1px solid var(--color-border); }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: var(--color-bg-secondary); }
      }
      &__actions { display: flex; gap: var(--spacing-xs); }
      &__empty {
        text-align: center;
        color: var(--color-text-muted);
        padding: var(--spacing-2xl) !important;
      }
    }
    .btn-sm { padding: 0.25rem 0.625rem; font-size: var(--font-size-xs); }
    .btn-danger { color: var(--color-error) !important; }
  `],
})
export class DashboardComponent implements OnInit {
  private readonly projectService = inject(ProjectService);
  protected readonly authService = inject(AuthService);

  protected readonly projects = signal<Project[]>([]);
  protected readonly isLoading = signal(true);

  ngOnInit(): void {
    this.projectService.getProjects(0, 50).subscribe({
      next: (data) => {
        this.projects.set(data.content);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  deleteProject(id: number): void {
    if (!confirm('Archiver ce projet ?')) return;
    this.projectService.deleteProject(id).subscribe({
      next: () => {
        this.projects.update((list) => list.filter((p) => p.id !== id));
      },
    });
  }
}
