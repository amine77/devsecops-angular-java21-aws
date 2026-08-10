import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';

import { ArticleCardComponent } from '@shared/components/article-card/article-card.component';
import { LoadingSpinnerComponent } from '@shared/components/loading-spinner/loading-spinner.component';
import { LanguageService } from '@core/services/language.service';
import { ArticleService } from '@core/services/article.service';
import { TranslatePipe } from '@core/pipes/translate.pipe';
import { PageResponse } from '@shared/models/api-response.model';
import { Article } from '@shared/models/article.model';

@Component({
  selector: 'app-blog-list',
  imports: [ArticleCardComponent, LoadingSpinnerComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="section blog-page">
      <div class="container">
        <div class="blog-header">
          <h1 class="section-title" style="text-align:left; margin-bottom: 0.5rem">
            {{ 'blog.title' | translate }}
          </h1>
          <p class="section-subtitle" style="text-align:left; margin-bottom: 0">
            {{ 'blog.subtitle' | translate }}
          </p>
        </div>

        @if (allTags().length > 0) {
          <div class="blog-tags">
            <button
              class="badge"
              [class.badge-blue]="selectedTag() === null"
              (click)="filterByTag(null)"
            >
              {{ 'blog.tags.all' | translate }}
            </button>
            @for (tag of allTags(); track tag) {
              <button
                class="badge"
                [class.badge-blue]="selectedTag() === tag"
                (click)="filterByTag(tag)"
              >
                {{ tag }}
              </button>
            }
          </div>
        }

        @if (isLoading()) {
          <app-loading-spinner [message]="'blog.loading' | translate" [fullPage]="true" />
        } @else if (error()) {
          <div class="error-state">
            <div class="error-state__icon" aria-hidden="true">⚠</div>
            <p>{{ error() }}</p>
            <button class="btn btn-outline" (click)="loadArticles()">
              {{ 'blog.retry' | translate }}
            </button>
          </div>
        } @else {
          <div class="grid-projects">
            @for (article of pageData()?.content ?? []; track article.id) {
              <app-article-card [article]="article" />
            } @empty {
              <div class="empty-state">
                <p>{{ 'blog.empty' | translate }}</p>
              </div>
            }
          </div>

          @if (pageData() && pageData()!.totalPages > 1) {
            <nav class="pagination" aria-label="Pagination des articles">
              <button class="btn btn-ghost" [disabled]="pageData()!.first" (click)="prevPage()">
                {{ 'blog.prev' | translate }}
              </button>
              <span class="pagination__info">
                {{ (pageData()?.page ?? 0) + 1 }} / {{ pageData()?.totalPages }}
              </span>
              <button class="btn btn-ghost" [disabled]="pageData()!.last" (click)="nextPage()">
                {{ 'blog.next' | translate }}
              </button>
            </nav>
          }
        }
      </div>
    </div>
  `,
  styles: [
    `
      .blog-header {
        margin-bottom: var(--spacing-lg);
      }
      .blog-tags {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-xs);
        margin-bottom: var(--spacing-2xl);
      }
      .blog-tags button {
        cursor: pointer;
        border: 1px solid var(--color-border);
        background: transparent;
        font: inherit;
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
    `,
  ],
})
export class BlogListComponent implements OnInit {
  private readonly articleService = inject(ArticleService);
  private readonly lang = inject(LanguageService);

  protected readonly pageData = signal<PageResponse<Article> | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly selectedTag = signal<string | null>(null);
  protected readonly allTags = signal<string[]>([]);

  private currentPage = 0;

  ngOnInit(): void {
    this.loadArticles();
  }

  protected loadArticles(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.articleService.getArticles(this.currentPage, 9, this.selectedTag() ?? undefined).subscribe({
      next: (data) => {
        this.pageData.set(data);
        this.isLoading.set(false);
        this.updateKnownTags(data.content);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: () => {
        this.error.set(this.lang.translate('blog.error'));
        this.isLoading.set(false);
      },
    });
  }

  protected filterByTag(tag: string | null): void {
    this.selectedTag.set(tag);
    this.currentPage = 0;
    this.loadArticles();
  }

  protected nextPage(): void {
    this.currentPage++;
    this.loadArticles();
  }

  protected prevPage(): void {
    this.currentPage--;
    this.loadArticles();
  }

  private updateKnownTags(articles: Article[]): void {
    const known = new Set(this.allTags());
    articles.forEach((a) => a.tags.forEach((t) => known.add(t)));
    this.allTags.set(Array.from(known).sort());
  }
}
