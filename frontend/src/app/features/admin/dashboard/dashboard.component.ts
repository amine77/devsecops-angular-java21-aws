import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import gsap from 'gsap';

import { ProjectService } from '@core/services/project.service';
import { ArticleService } from '@core/services/article.service';
import { AuthService } from '@core/services/auth.service';
import { LanguageService } from '@core/services/language.service';
import { ScrollAnimationService } from '@core/animation/scroll-animation.service';
import { Project } from '@shared/models/project.model';
import { Article } from '@shared/models/article.model';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { TranslatePipe } from '@core/pipes/translate.pipe';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    TranslatePipe,
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
        <div class="dashboard-header" #header>
          <div>
            <h1>{{ 'admin.dashboard.title' | translate }}</h1>
            <p>{{ 'admin.dashboard.welcome' | translate }} {{ authService.displayName() }}</p>
          </div>
          <a routerLink="/admin/projects/new" mat-raised-button color="primary">
            <mat-icon>add</mat-icon>
            {{ 'admin.dashboard.new' | translate }}
          </a>
        </div>

        @if (isLoading()) {
          <div class="dashboard-loading">
            <mat-spinner diameter="48" />
          </div>
        } @else {
          <div class="mat-elevation-z2 projects-table-container" #tableContainer>
            <table mat-table [dataSource]="projects()" class="dashboard-table">
              <ng-container matColumnDef="title">
                <th mat-header-cell *matHeaderCellDef>
                  {{ 'admin.dashboard.col.title' | translate }}
                </th>
                <td mat-cell *matCellDef="let p">{{ p.title }}</td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>
                  {{ 'admin.dashboard.col.status' | translate }}
                </th>
                <td mat-cell *matCellDef="let p">
                  <mat-chip [class]="p.status === 'ACTIVE' ? 'chip-active' : 'chip-archived'">
                    {{
                      p.status === 'ACTIVE'
                        ? ('admin.dashboard.status.active' | translate)
                        : ('admin.dashboard.status.archived' | translate)
                    }}
                  </mat-chip>
                </td>
              </ng-container>

              <ng-container matColumnDef="featured">
                <th mat-header-cell *matHeaderCellDef>
                  {{ 'admin.dashboard.col.featured' | translate }}
                </th>
                <td mat-cell *matCellDef="let p">
                  <mat-icon [class]="p.featured ? 'icon-star' : 'icon-muted'">
                    {{ p.featured ? 'star' : 'star_border' }}
                  </mat-icon>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>
                  {{ 'admin.dashboard.col.actions' | translate }}
                </th>
                <td mat-cell *matCellDef="let p" class="actions-cell">
                  <div class="actions-wrap">
                    <a
                      [routerLink]="['/admin/projects', p.id, 'edit']"
                      mat-icon-button
                      matTooltip="{{ 'admin.dashboard.edit' | translate }}"
                      color="primary"
                    >
                      <mat-icon>edit</mat-icon>
                    </a>
                    <button
                      mat-icon-button
                      matTooltip="{{ 'admin.dashboard.archive' | translate }}"
                      color="warn"
                      (click)="confirmDelete(p)"
                    >
                      <mat-icon>archive</mat-icon>
                    </button>
                  </div>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns"></tr>

              <tr class="mat-row" *matNoDataRow>
                <td class="mat-cell no-data" [attr.colspan]="columns.length">
                  {{ 'admin.dashboard.empty' | translate }}
                </td>
              </tr>
            </table>
          </div>
        }

        <div class="dashboard-header dashboard-header--articles">
          <h2>{{ 'admin.dashboard.tab.articles' | translate }}</h2>
          <a routerLink="/admin/articles/new" mat-raised-button color="primary">
            <mat-icon>add</mat-icon>
            {{ 'admin.dashboard.new.article' | translate }}
          </a>
        </div>

        @if (isLoadingArticles()) {
          <div class="dashboard-loading">
            <mat-spinner diameter="48" />
          </div>
        } @else {
          <div class="mat-elevation-z2 articles-table-container">
            <table mat-table [dataSource]="articles()" class="dashboard-table">
              <ng-container matColumnDef="title">
                <th mat-header-cell *matHeaderCellDef>
                  {{ 'admin.dashboard.col.title' | translate }}
                </th>
                <td mat-cell *matCellDef="let a">{{ a.title }}</td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>
                  {{ 'admin.dashboard.col.status' | translate }}
                </th>
                <td mat-cell *matCellDef="let a">
                  <mat-chip [class]="a.status === 'PUBLISHED' ? 'chip-active' : 'chip-archived'">
                    {{
                      a.status === 'PUBLISHED'
                        ? ('admin.dashboard.status.published' | translate)
                        : ('admin.dashboard.status.draft' | translate)
                    }}
                  </mat-chip>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>
                  {{ 'admin.dashboard.col.actions' | translate }}
                </th>
                <td mat-cell *matCellDef="let a" class="actions-cell">
                  <div class="actions-wrap">
                    <a
                      [routerLink]="['/admin/articles', a.id, 'edit']"
                      mat-icon-button
                      matTooltip="{{ 'admin.dashboard.edit' | translate }}"
                      color="primary"
                    >
                      <mat-icon>edit</mat-icon>
                    </a>
                    <button
                      mat-icon-button
                      matTooltip="{{ 'admin.dashboard.delete' | translate }}"
                      color="warn"
                      (click)="confirmDeleteArticle(a)"
                    >
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="articleColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: articleColumns"></tr>

              <tr class="mat-row" *matNoDataRow>
                <td class="mat-cell no-data" [attr.colspan]="articleColumns.length">
                  {{ 'admin.dashboard.empty' | translate }}
                </td>
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
      .dashboard-header--articles {
        margin-top: 3rem;
      }
      .dashboard-loading {
        display: flex;
        justify-content: center;
        padding: 3rem;
      }
      .dashboard-table {
        width: 100%;
      }
      .actions-wrap {
        display: flex;
        align-items: center;
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
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly projectService = inject(ProjectService);
  private readonly articleService = inject(ArticleService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly scrollAnim = inject(ScrollAnimationService);
  private readonly ngZone = inject(NgZone);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly authService = inject(AuthService);
  private readonly lang = inject(LanguageService);

  protected readonly columns = ['title', 'status', 'featured', 'actions'];
  protected readonly articleColumns = ['title', 'status', 'actions'];
  protected readonly projects = signal<Project[]>([]);
  protected readonly articles = signal<Article[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isLoadingArticles = signal(true);

  private headerTl?: gsap.core.Timeline;
  private projectsTableAnimated = false;
  private articlesTableAnimated = false;

  constructor() {
    effect(() => {
      const list = this.projects();
      if (list.length > 0 && !this.projectsTableAnimated && !this.scrollAnim.reducedMotion) {
        this.projectsTableAnimated = true;
        untracked(() => {
          setTimeout(() => this.animateTable('.projects-table-container'), 30);
        });
      }
    });

    effect(() => {
      const list = this.articles();
      if (list.length > 0 && !this.articlesTableAnimated && !this.scrollAnim.reducedMotion) {
        this.articlesTableAnimated = true;
        untracked(() => {
          setTimeout(() => this.animateTable('.articles-table-container'), 30);
        });
      }
    });
  }

  ngOnInit(): void {
    this.projectService.getProjects(0, 50).subscribe({
      next: (data) => {
        this.projects.set(data.content);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });

    this.articleService.getArticlesForAdmin(0, 50).subscribe({
      next: (data) => {
        this.articles.set(data.content);
        this.isLoadingArticles.set(false);
      },
      error: () => this.isLoadingArticles.set(false),
    });
  }

  ngAfterViewInit(): void {
    if (this.scrollAnim.reducedMotion) return;
    this.animateHeader();
  }

  ngOnDestroy(): void {
    this.headerTl?.kill();
  }

  private animateHeader(): void {
    const header = this.el.nativeElement.querySelector<HTMLElement>('.dashboard-header');
    if (!header) return;
    this.ngZone.runOutsideAngular(() => {
      this.headerTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      this.headerTl.from(header, { opacity: 0, y: -24, duration: 0.55 });
    });
  }

  private animateTable(containerSelector: string): void {
    const container = this.el.nativeElement.querySelector<HTMLElement>(containerSelector);
    if (!container) return;
    const rows = Array.from(container.querySelectorAll<HTMLElement>('tr.mat-mdc-row'));

    this.ngZone.runOutsideAngular(() => {
      gsap.from(container, { opacity: 0, y: 20, duration: 0.5, ease: 'power2.out' });
      if (rows.length > 0) {
        gsap.from(rows, {
          opacity: 0,
          x: -16,
          stagger: 0.05,
          duration: 0.4,
          ease: 'power2.out',
          delay: 0.15,
        });
      }
    });
  }

  confirmDelete(project: Project): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.lang.translate('admin.confirm.archive.title'),
        message: `${this.lang.translate('admin.confirm.archive.title')} « ${project.title} » ?`,
        confirmLabel: this.lang.translate('admin.confirm.archive.confirm'),
        confirmColor: 'warn',
      },
    });

    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.projectService.deleteProject(project.id).subscribe({
        next: () => {
          this.projects.update((list) => list.filter((p) => p.id !== project.id));
          this.snackBar.open(this.lang.translate('admin.dashboard.archived.success'), 'OK', {
            duration: 3000,
          });
        },
        error: () => {
          this.snackBar.open(this.lang.translate('admin.dashboard.archived.error'), 'OK', {
            duration: 4000,
          });
        },
      });
    });
  }

  confirmDeleteArticle(article: Article): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.lang.translate('admin.confirm.delete.title'),
        message: `${this.lang.translate('admin.confirm.delete.title')} « ${article.title} » ?`,
        confirmLabel: this.lang.translate('admin.confirm.delete.confirm'),
        confirmColor: 'warn',
      },
    });

    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.articleService.deleteArticle(article.id).subscribe({
        next: () => {
          this.articles.update((list) => list.filter((a) => a.id !== article.id));
          this.snackBar.open(this.lang.translate('admin.dashboard.deleted.success'), 'OK', {
            duration: 3000,
          });
        },
        error: () => {
          this.snackBar.open(this.lang.translate('admin.dashboard.deleted.error'), 'OK', {
            duration: 4000,
          });
        },
      });
    });
  }
}
