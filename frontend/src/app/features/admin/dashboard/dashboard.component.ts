import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ProjectService } from '@core/services/project.service';
import { AuthService } from '@core/services/auth.service';
import { Project } from '@shared/models/project.model';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="section">
      <div class="container">
        <div class="dashboard-header">
          <div>
            <h1>Dashboard Admin</h1>
            <p>Bienvenue, {{ authService.displayName() }}</p>
          </div>
          <a routerLink="/admin/projects/new" mat-raised-button color="primary">
            <mat-icon>add</mat-icon>
            Nouveau projet
          </a>
        </div>

        @if (isLoading()) {
          <div class="dashboard-loading">
            <mat-spinner diameter="48" />
          </div>
        } @else {
          <div class="mat-elevation-z2">
            <table mat-table [dataSource]="projects()" class="dashboard-table">
              <ng-container matColumnDef="title">
                <th mat-header-cell *matHeaderCellDef>Titre</th>
                <td mat-cell *matCellDef="let p">{{ p.title }}</td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Statut</th>
                <td mat-cell *matCellDef="let p">
                  <mat-chip [class]="p.status === 'ACTIVE' ? 'chip-active' : 'chip-archived'">
                    {{ p.status === 'ACTIVE' ? 'Actif' : 'Archivé' }}
                  </mat-chip>
                </td>
              </ng-container>

              <ng-container matColumnDef="featured">
                <th mat-header-cell *matHeaderCellDef>Vedette</th>
                <td mat-cell *matCellDef="let p">
                  <mat-icon [class]="p.featured ? 'icon-star' : 'icon-muted'">
                    {{ p.featured ? 'star' : 'star_border' }}
                  </mat-icon>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Actions</th>
                <td mat-cell *matCellDef="let p" class="actions-cell">
                  <a
                    [routerLink]="['/admin/projects', p.id, 'edit']"
                    mat-icon-button
                    matTooltip="Modifier"
                    color="primary"
                  >
                    <mat-icon>edit</mat-icon>
                  </a>
                  <button
                    mat-icon-button
                    matTooltip="Archiver"
                    color="warn"
                    (click)="confirmDelete(p)"
                  >
                    <mat-icon>archive</mat-icon>
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns"></tr>

              <tr class="mat-row" *matNoDataRow>
                <td class="mat-cell no-data" [attr.colspan]="columns.length">Aucun projet.</td>
              </tr>
            </table>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .dashboard-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 2rem;
        p {
          margin-top: 0.25rem;
          color: var(--color-text-secondary);
        }
      }
      .dashboard-loading {
        display: flex;
        justify-content: center;
        padding: 3rem;
      }
      .dashboard-table {
        width: 100%;
      }
      .actions-cell {
        display: flex;
        gap: 0.25rem;
      }
      .no-data {
        text-align: center;
        padding: 2rem !important;
        color: var(--color-text-muted);
      }
      .chip-active {
        --mdc-chip-label-text-color: #34d399;
        background: rgba(16, 185, 129, 0.15) !important;
      }
      .chip-archived {
        --mdc-chip-label-text-color: #fbbf24;
        background: rgba(245, 158, 11, 0.15) !important;
      }
      .icon-star {
        color: #fbbf24;
      }
      .icon-muted {
        color: var(--color-text-muted);
      }
    `,
  ],
})
export class DashboardComponent implements OnInit {
  private readonly projectService = inject(ProjectService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly authService = inject(AuthService);

  protected readonly columns = ['title', 'status', 'featured', 'actions'];
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

  confirmDelete(project: Project): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Archiver le projet',
        message: `Archiver « ${project.title} » ?`,
        confirmLabel: 'Archiver',
        confirmColor: 'warn',
      },
    });

    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.projectService.deleteProject(project.id).subscribe({
        next: () => {
          this.projects.update((list) => list.filter((p) => p.id !== project.id));
          this.snackBar.open('Projet archivé.', 'OK', { duration: 3000 });
        },
        error: () => {
          this.snackBar.open("Erreur lors de l'archivage.", 'OK', { duration: 4000 });
        },
      });
    });
  }
}
