import { ChangeDetectionStrategy, Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule, MatChipInputEvent } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

import { ArticleService } from '@core/services/article.service';
import { LanguageService } from '@core/services/language.service';
import { TranslatePipe } from '@core/pipes/translate.pipe';
import { ArticleStatus } from '@shared/models/article.model';
import { ErrorResponse } from '@shared/models/api-response.model';

const URL_PATTERN = /^https?:\/\/.+/;

@Component({
  selector: 'app-article-form',
  standalone: true,
  imports: [
    TranslatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="section">
      <div class="container container--narrow">
        <div class="form-header">
          <a routerLink="/admin" mat-icon-button [matTooltip]="'admin.form.back' | translate">
            <mat-icon>arrow_back</mat-icon>
          </a>
          <h1>
            {{ (isEditMode ? 'admin.form.article.title.edit' : 'admin.form.article.title.create') | translate }}
          </h1>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="article-form">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'admin.form.field.title' | translate }}</mat-label>
            <input matInput formControlName="title" [placeholder]="'admin.form.placeholder.title' | translate" />
            @if (isInvalid('title')) {
              <mat-error>{{ 'admin.form.field.title.error' | translate }}</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'admin.form.field.summary' | translate }}</mat-label>
            <input
              matInput
              formControlName="summary"
              [placeholder]="'admin.form.placeholder.summary' | translate"
            />
            @if (isInvalid('summary')) {
              <mat-error>{{ 'admin.form.field.summary.error' | translate }}</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'admin.form.field.image' | translate }}</mat-label>
            <input matInput formControlName="coverImageUrl" placeholder="https://..." />
            @if (isInvalid('coverImageUrl')) {
              <mat-error>{{ 'admin.form.field.url.error' | translate }}</mat-error>
            }
          </mat-form-field>

          <div class="tags-section">
            <p class="tags-label">{{ 'admin.form.field.tags' | translate }}</p>
            <mat-chip-grid #chipGrid>
              @for (tag of tags(); track tag) {
                <mat-chip-row (removed)="removeTag(tag)">
                  {{ tag }}
                  <button matChipRemove><mat-icon>cancel</mat-icon></button>
                </mat-chip-row>
              }
              <input
                [placeholder]="'admin.form.field.tags.placeholder' | translate"
                [matChipInputFor]="chipGrid"
                (matChipInputTokenEnd)="addTag($event)"
              />
            </mat-chip-grid>
          </div>

          <div class="content-section">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ 'admin.form.field.content' | translate }}</mat-label>
              <textarea matInput formControlName="content" rows="14"></textarea>
              @if (isInvalid('content')) {
                <mat-error>{{ 'admin.form.field.content.error' | translate }}</mat-error>
              }
            </mat-form-field>

            <div class="content-preview">
              <p class="tags-label">{{ 'admin.form.preview' | translate }}</p>
              <div class="content-preview__body" [innerHTML]="previewHtml()"></div>
            </div>
          </div>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'admin.form.field.status' | translate }}</mat-label>
            <mat-select formControlName="status">
              <mat-option value="DRAFT">{{ 'admin.form.field.status.draft' | translate }}</mat-option>
              <mat-option value="PUBLISHED">{{ 'admin.form.field.status.published' | translate }}</mat-option>
            </mat-select>
          </mat-form-field>

          @if (errorMessage()) {
            <div class="form-error-banner">
              <mat-icon>error_outline</mat-icon>
              {{ errorMessage() }}
            </div>
          }

          <div class="form-actions">
            <a routerLink="/admin" mat-button>{{ 'admin.confirm.cancel' | translate }}</a>
            <button mat-raised-button color="primary" type="submit" [disabled]="isLoading()">
              @if (isLoading()) {
                <mat-progress-spinner mode="indeterminate" diameter="18" />
              }
              {{
                (isEditMode ? 'admin.form.article.submit.edit' : 'admin.form.article.submit.create')
                  | translate
              }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [
    `
      .container--narrow {
        max-width: 960px;
      }
      .form-header {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1.5rem;
      }
      .article-form {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .full-width {
        width: 100%;
      }
      .tags-section {
        margin: 0.5rem 0;
      }
      .tags-label {
        font-size: 0.875rem;
        color: var(--color-text-secondary);
        margin-bottom: 0.5rem;
      }
      .content-section {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        align-items: start;
      }
      .content-preview {
        border: 1px solid var(--color-border);
        border-radius: 0.5rem;
        padding: 0.75rem;
      }
      .content-preview__body {
        max-height: 320px;
        overflow-y: auto;
        color: var(--color-text-secondary);
        font-size: 0.9rem;
        line-height: 1.6;
      }
      .form-error-banner {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        border-radius: 0.5rem;
        background: rgba(239, 68, 68, 0.12);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #fca5a5;
        font-size: 0.875rem;
      }
      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        margin-top: 0.5rem;
      }
      @media (max-width: 720px) {
        .content-section {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class ArticleFormComponent implements OnInit {
  @Input() id?: string;

  private readonly fb = inject(FormBuilder);
  private readonly articleService = inject(ArticleService);
  private readonly router = inject(Router);
  private readonly lang = inject(LanguageService);

  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly tags = signal<string[]>([]);

  protected get isEditMode(): boolean {
    return !!this.id;
  }

  protected readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    summary: ['', [Validators.maxLength(500)]],
    coverImageUrl: ['', [Validators.pattern(URL_PATTERN)]],
    content: ['', [Validators.required]],
    status: ['DRAFT' as ArticleStatus],
  });

  ngOnInit(): void {
    if (this.id) {
      this.articleService.getArticleByIdForAdmin(Number(this.id)).subscribe((a) => {
        this.form.patchValue({
          title: a.title,
          summary: a.summary ?? '',
          coverImageUrl: a.coverImageUrl ?? '',
          content: a.content,
          status: a.status,
        });
        this.tags.set([...a.tags]);
      });
    }
  }

  protected isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.touched && ctrl.invalid);
  }

  protected previewHtml(): string {
    const content = this.form.get('content')?.value ?? '';
    const rawHtml = marked.parse(content, { async: false }) as string;
    return DOMPurify.sanitize(rawHtml);
  }

  addTag(event: MatChipInputEvent): void {
    const value = (event.value ?? '').trim();
    if (value && !this.tags().includes(value)) {
      this.tags.update((current) => [...current, value]);
    }
    event.chipInput?.clear();
  }

  removeTag(tag: string): void {
    this.tags.update((current) => current.filter((t) => t !== tag));
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const data = {
      title: this.form.value.title!,
      summary: this.form.value.summary || undefined,
      coverImageUrl: this.form.value.coverImageUrl || undefined,
      content: this.form.value.content!,
      tags: this.tags(),
      status: this.form.value.status as ArticleStatus,
    };

    const request$ = this.id
      ? this.articleService.updateArticle(Number(this.id), data)
      : this.articleService.createArticle(data);

    request$.subscribe({
      next: () => {
        void this.router.navigate(['/admin']);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.errorMessage.set(this.extractErrorMessage(err));
      },
    });
  }

  private extractErrorMessage(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return this.lang.translate('admin.form.error.network');
    }

    const body = err.error as ErrorResponse | undefined;
    const firstValidationError = body?.validationErrors
      ? Object.values(body.validationErrors)[0]
      : undefined;

    return firstValidationError ?? body?.message ?? this.lang.translate('admin.form.error');
  }
}
