import { ChangeDetectionStrategy, Component, Input, OnInit, inject, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

import { LoadingSpinnerComponent } from '@shared/components/loading-spinner/loading-spinner.component';
import { ArticleService } from '@core/services/article.service';
import { LanguageService } from '@core/services/language.service';
import { Article } from '@shared/models/article.model';
import { TranslatePipe } from '@core/pipes/translate.pipe';

/**
 * Détail d'un article de blog.
 *
 * Reçoit le slug via @Input() grâce à withComponentInputBinding()
 * configuré dans app.config.ts (le paramètre de route s'appelle :slug).
 */
@Component({
  selector: 'app-blog-detail',
  imports: [RouterLink, LoadingSpinnerComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isLoading()) {
      <app-loading-spinner [message]="'blog.detail.loading' | translate" [fullPage]="true" />
    } @else if (error()) {
      <div class="section container bd-error">
        <div class="bd-error__icon" aria-hidden="true">⚠</div>
        <p>{{ error() }}</p>
        <a routerLink="/portfolio/blog" class="btn btn-outline">{{ 'blog.back' | translate }}</a>
      </div>
    } @else if (article()) {
      <div class="bd-hero">
        <div class="container">
          <a routerLink="/portfolio/blog" class="bd-back">{{ 'blog.back' | translate }}</a>
          <h1 class="bd-hero__title">{{ article()!.title }}</h1>
          @if (article()!.tags.length > 0) {
            <div class="bd-hero__tags">
              @for (tag of article()!.tags; track tag) {
                <span class="badge badge-blue">{{ tag }}</span>
              }
            </div>
          }
        </div>
      </div>

      <div class="section bd-body">
        <div class="container bd-layout">
          @if (article()!.coverImageUrl) {
            <img [src]="article()!.coverImageUrl" [alt]="article()!.title" class="bd-image" />
          }
          <div class="bd-content" [innerHTML]="renderedHtml()"></div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .bd-hero {
        padding: var(--spacing-2xl) 0 var(--spacing-xl);
        background: var(--color-bg-secondary);
        border-bottom: 1px solid var(--color-border);
      }
      .bd-back {
        display: inline-flex;
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
        margin-bottom: var(--spacing-xl);
        text-decoration: none;
      }
      .bd-back:hover {
        color: var(--color-accent);
      }
      .bd-hero__title {
        font-size: clamp(1.75rem, 4vw, 2.75rem);
        font-weight: 700;
        color: var(--color-text-primary);
        margin: 0 0 var(--spacing-md);
        max-width: 720px;
      }
      .bd-hero__tags {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-xs);
      }
      .bd-layout {
        max-width: 720px;
      }
      .bd-image {
        width: 100%;
        max-height: 420px;
        object-fit: cover;
        border-radius: var(--radius-lg);
        margin-bottom: var(--spacing-xl);
      }
      .bd-content {
        color: var(--color-text-secondary);
        font-size: var(--font-size-lg);
        line-height: 1.8;
      }
      .bd-content ::ng-deep h1,
      .bd-content ::ng-deep h2,
      .bd-content ::ng-deep h3 {
        color: var(--color-text-primary);
        margin: var(--spacing-xl) 0 var(--spacing-md);
      }
      .bd-content ::ng-deep p {
        margin: 0 0 var(--spacing-lg);
      }
      .bd-content ::ng-deep pre {
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: var(--spacing-md);
        overflow-x: auto;
      }
      .bd-content ::ng-deep code {
        font-family: var(--font-mono);
        font-size: var(--font-size-sm);
      }
      .bd-error {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--spacing-lg);
        text-align: center;
      }
      .bd-error__icon {
        font-size: 2.5rem;
        color: var(--color-warning);
      }
    `,
  ],
})
export class BlogDetailComponent implements OnInit {
  /** Injecté depuis le param de route :slug grâce à withComponentInputBinding() */
  @Input() slug!: string;

  private readonly articleService = inject(ArticleService);
  private readonly lang = inject(LanguageService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly article = signal<Article | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.articleService.getArticleBySlug(this.slug).subscribe({
      next: (a) => {
        this.article.set(a);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set(this.lang.translate('blog.detail.error'));
        this.isLoading.set(false);
      },
    });
  }

  protected renderedContent(): string {
    const content = this.article()?.content ?? '';
    const rawHtml = marked.parse(content, { async: false }) as string;
    return DOMPurify.sanitize(rawHtml);
  }

  protected renderedHtml(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.renderedContent());
  }
}
