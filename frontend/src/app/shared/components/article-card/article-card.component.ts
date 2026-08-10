import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { Article } from '@shared/models/article.model';
import { TranslatePipe } from '@core/pipes/translate.pipe';

@Component({
  selector: 'app-article-card',
  imports: [RouterLink, SlicePipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="article-card card">
      <div class="article-card__image">
        @if (article.coverImageUrl) {
          <img [src]="article.coverImageUrl" [alt]="article.title" loading="lazy" />
        } @else {
          <div class="article-card__placeholder" aria-hidden="true">
            <div class="article-card__placeholder-grid"></div>
            <span class="article-card__placeholder-icon">&lt;/&gt;</span>
          </div>
        }
      </div>

      <div class="article-card__body">
        <h3 class="article-card__title">{{ article.title }}</h3>
        <p class="article-card__summary">
          {{ article.summary || (article.content | slice: 0 : 120) }}...
        </p>

        @if (article.tags.length > 0) {
          <div class="article-card__tags">
            @for (tag of article.tags | slice: 0 : 4; track tag) {
              <span class="badge badge-blue">{{ tag }}</span>
            }
          </div>
        }

        <div class="article-card__actions">
          <a [routerLink]="['/portfolio/blog', article.slug]" class="btn btn-primary btn-sm">
            {{ 'blog.card.readMore' | translate }}
          </a>
        </div>
      </div>
    </article>
  `,
  styles: [
    `
      .article-card {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        padding: 0;
        transition:
          transform 0.25s ease,
          box-shadow 0.25s ease,
          border-color 0.25s ease;
      }
      .article-card:hover {
        transform: translateY(-4px);
        box-shadow:
          0 20px 40px -12px rgba(0, 0, 0, 0.5),
          0 0 20px rgba(59, 130, 246, 0.2);
        border-color: rgba(59, 130, 246, 0.4);
      }
      .article-card__image {
        position: relative;
        height: 200px;
        overflow: hidden;
      }
      .article-card__image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.4s ease;
      }
      .article-card:hover .article-card__image img {
        transform: scale(1.06);
      }
      .article-card__placeholder {
        position: relative;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .article-card__placeholder-grid {
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(rgba(59, 130, 246, 0.07) 1px, transparent 1px),
          linear-gradient(90deg, rgba(59, 130, 246, 0.07) 1px, transparent 1px);
        background-size: 24px 24px;
      }
      .article-card__placeholder-icon {
        position: relative;
        font-family: var(--font-mono);
        font-size: 2.5rem;
        font-weight: 700;
        color: var(--color-accent);
        opacity: 0.3;
        z-index: 1;
      }
      .article-card__body {
        flex: 1;
        padding: var(--spacing-lg);
        display: flex;
        flex-direction: column;
        gap: var(--spacing-sm);
      }
      .article-card__title {
        font-size: var(--font-size-lg);
        font-weight: 600;
        color: var(--color-text-primary);
        margin: 0;
        transition: color var(--transition-fast);
      }
      .article-card:hover .article-card__title {
        color: var(--color-accent);
      }
      .article-card__summary {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        line-height: 1.6;
        flex: 1;
        margin: 0;
      }
      .article-card__tags {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-xs);
      }
      .article-card__actions {
        display: flex;
        gap: var(--spacing-sm);
        margin-top: var(--spacing-sm);
        flex-wrap: wrap;
      }
      .btn-sm {
        padding: 0.375rem 0.875rem;
        font-size: var(--font-size-xs);
      }
    `,
  ],
})
export class ArticleCardComponent {
  @Input({ required: true }) article!: Article;
}
