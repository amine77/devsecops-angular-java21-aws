import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import gsap from 'gsap';

import { ProjectCardComponent } from '@shared/components/project-card/project-card.component';
import { LoadingSpinnerComponent } from '@shared/components/loading-spinner/loading-spinner.component';
import { ScrollRevealDirective } from '@shared/directives/scroll-reveal.directive';
import { LanguageService } from '@core/services/language.service';
import { ProjectService } from '@core/services/project.service';
import { ScrollAnimationService } from '@core/animation/scroll-animation.service';
import { TranslatePipe } from '@core/pipes/translate.pipe';
import { PageResponse } from '@shared/models/api-response.model';
import { Project } from '@shared/models/project.model';

@Component({
  selector: 'app-project-list',
  imports: [ProjectCardComponent, LoadingSpinnerComponent, ScrollRevealDirective, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="section projects-page">
      <div class="container">
        <!-- Page header -->
        <div class="projects-header" #header>
          <div>
            <h1 #title class="section-title" style="text-align:left; margin-bottom: 0.5rem">
              {{ 'projects.title' | translate }}
            </h1>
            <p #subtitle class="section-subtitle" style="text-align:left; margin-bottom: 0">
              {{ 'projects.subtitle' | translate }}
            </p>
          </div>
          @if (pageData() && !isLoading()) {
            <span #badge class="projects-count badge badge-blue">
              {{ pageData()!.totalElements }} projet{{ pageData()!.totalElements > 1 ? 's' : '' }}
            </span>
          }
        </div>

        @if (isLoading()) {
          <app-loading-spinner [message]="'projects.loading' | translate" [fullPage]="true" />
        } @else if (error()) {
          <div class="error-state">
            <div class="error-state__icon" aria-hidden="true">⚠</div>
            <p>{{ error() }}</p>
            <button class="btn btn-outline" (click)="loadProjects()">
              {{ 'projects.retry' | translate }}
            </button>
          </div>
        } @else {
          <div class="grid-projects">
            @for (project of pageData()?.content ?? []; track project.id; let i = $index) {
              <app-project-card
                [project]="project"
                appScrollReveal
                revealEffect="deploy"
                [revealDelay]="i * 90"
              />
            } @empty {
              <div class="empty-state">
                <p>{{ 'projects.empty' | translate }}</p>
              </div>
            }
          </div>

          @if (pageData() && pageData()!.totalPages > 1) {
            <nav
              class="pagination"
              aria-label="Pagination des projets"
              appScrollReveal
              [revealDelay]="400"
            >
              <button class="btn btn-ghost" [disabled]="pageData()!.first" (click)="prevPage()">
                {{ 'projects.prev' | translate }}
              </button>
              <span class="pagination__info">
                Page {{ (pageData()?.page ?? 0) + 1 }} / {{ pageData()?.totalPages }}
              </span>
              <button class="btn btn-ghost" [disabled]="pageData()!.last" (click)="nextPage()">
                {{ 'projects.next' | translate }}
              </button>
            </nav>
          }
        }
      </div>
    </div>
  `,
  styles: [
    `
      .projects-header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        margin-bottom: var(--spacing-2xl);
        gap: var(--spacing-md);
        overflow: hidden;
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
        .projects-header {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    `,
  ],
})
export class ProjectListComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly projectService = inject(ProjectService);
  private readonly lang = inject(LanguageService);
  private readonly ngZone = inject(NgZone);
  private readonly scrollAnim = inject(ScrollAnimationService);

  protected readonly pageData = signal<PageResponse<Project> | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);

  private currentPage = 0;
  private headerTl?: gsap.core.Timeline;

  private readonly titleEl = viewChild<ElementRef<HTMLElement>>('title');
  private readonly subtitleEl = viewChild<ElementRef<HTMLElement>>('subtitle');

  ngOnInit(): void {
    this.loadProjects();
  }

  ngAfterViewInit(): void {
    if (this.scrollAnim.reducedMotion) return;
    this.animateHeader();
  }

  ngOnDestroy(): void {
    this.headerTl?.kill();
  }

  private animateHeader(): void {
    const title = this.titleEl()?.nativeElement;
    const subtitle = this.subtitleEl()?.nativeElement;
    if (!title || !subtitle) return;

    this.ngZone.runOutsideAngular(() => {
      this.headerTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      this.headerTl
        .from(title, { opacity: 0, y: 28, duration: 0.65 })
        .from(subtitle, { opacity: 0, y: 20, duration: 0.55 }, '-=0.35');
    });
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
        this.error.set(this.lang.translate('projects.list.error.load'));
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
