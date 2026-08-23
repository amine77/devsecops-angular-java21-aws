import { ChangeDetectionStrategy, Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule, MatChipInputEvent } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ExperienceService } from '@core/services/experience.service';
import { LanguageService } from '@core/services/language.service';
import { TranslatePipe } from '@core/pipes/translate.pipe';
import { ErrorResponse } from '@shared/models/api-response.model';

@Component({
  selector: 'app-experience-form',
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
    MatCheckboxModule,
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
            {{
              (isEditMode
                ? 'admin.form.experience.title.edit'
                : 'admin.form.experience.title.create') | translate
            }}
          </h1>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="experience-form">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'admin.form.field.entreprise' | translate }}</mat-label>
            <input matInput formControlName="entreprise" />
            @if (isInvalid('entreprise')) {
              <mat-error>{{ 'admin.form.field.entreprise.error' | translate }}</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'admin.form.field.poste' | translate }}</mat-label>
            <input matInput formControlName="poste" />
            @if (isInvalid('poste')) {
              <mat-error>{{ 'admin.form.field.poste.error' | translate }}</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'admin.form.field.contexte' | translate }}</mat-label>
            <input matInput formControlName="contexte" />
            @if (isInvalid('contexte')) {
              <mat-error>{{ 'admin.form.field.contexte.error' | translate }}</mat-error>
            }
          </mat-form-field>

          <div class="dates-row">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'admin.form.field.dateDebut' | translate }}</mat-label>
              <input matInput type="date" formControlName="dateDebut" />
              @if (isInvalid('dateDebut')) {
                <mat-error>{{ 'admin.form.field.dateDebut.error' | translate }}</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>{{ 'admin.form.field.dateFin' | translate }}</mat-label>
              <input matInput type="date" formControlName="dateFin" />
            </mat-form-field>

            <mat-checkbox formControlName="current" (change)="onCurrentChange()">
              {{ 'admin.form.field.current' | translate }}
            </mat-checkbox>
          </div>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'admin.form.field.description' | translate }}</mat-label>
            <textarea matInput formControlName="description" rows="4"></textarea>
            @if (isInvalid('description')) {
              <mat-error>{{ 'admin.form.field.description.error' | translate }}</mat-error>
            }
          </mat-form-field>

          <div class="tags-section">
            <p class="tags-label">{{ 'admin.form.field.realisations' | translate }}</p>
            <mat-chip-grid #realisationsGrid>
              @for (item of realisations(); track item) {
                <mat-chip-row (removed)="removeRealisation(item)">
                  {{ item }}
                  <button matChipRemove><mat-icon>cancel</mat-icon></button>
                </mat-chip-row>
              }
              <input
                [placeholder]="'admin.form.field.realisations.placeholder' | translate"
                [matChipInputFor]="realisationsGrid"
                (matChipInputTokenEnd)="addRealisation($event)"
              />
            </mat-chip-grid>
          </div>

          <div class="tags-section">
            <p class="tags-label">{{ 'admin.form.field.stack' | translate }}</p>
            <mat-chip-grid #stackGrid>
              @for (item of stack(); track item) {
                <mat-chip-row (removed)="removeStack(item)">
                  {{ item }}
                  <button matChipRemove><mat-icon>cancel</mat-icon></button>
                </mat-chip-row>
              }
              <input
                [placeholder]="'admin.form.field.stack.placeholder' | translate"
                [matChipInputFor]="stackGrid"
                (matChipInputTokenEnd)="addStack($event)"
              />
            </mat-chip-grid>
          </div>

          <mat-form-field appearance="outline" class="order-field">
            <mat-label>{{ 'admin.form.field.order' | translate }}</mat-label>
            <input matInput type="number" formControlName="ordreAffichage" />
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
                (isEditMode
                  ? 'admin.form.experience.submit.edit'
                  : 'admin.form.experience.submit.create') | translate
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
      .experience-form {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .full-width {
        width: 100%;
      }
      .dates-row {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
      }
      .order-field {
        max-width: 220px;
      }
      .tags-section {
        margin: 0.5rem 0;
      }
      .tags-label {
        font-size: 0.875rem;
        color: var(--color-text-secondary);
        margin-bottom: 0.5rem;
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
    `,
  ],
})
export class ExperienceFormComponent implements OnInit {
  @Input() id?: string;

  private readonly fb = inject(FormBuilder);
  private readonly experienceService = inject(ExperienceService);
  private readonly router = inject(Router);
  private readonly lang = inject(LanguageService);

  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly realisations = signal<string[]>([]);
  protected readonly stack = signal<string[]>([]);

  protected get isEditMode(): boolean {
    return !!this.id;
  }

  protected readonly form = this.fb.group({
    entreprise: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    poste: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    contexte: ['', [Validators.maxLength(500)]],
    dateDebut: ['', [Validators.required]],
    dateFin: [''],
    current: [false],
    description: ['', [Validators.required]],
    ordreAffichage: [0],
  });

  ngOnInit(): void {
    if (this.id) {
      this.experienceService.getExperienceById(Number(this.id)).subscribe((e) => {
        this.form.patchValue({
          entreprise: e.entreprise,
          poste: e.poste,
          contexte: e.contexte ?? '',
          dateDebut: e.dateDebut,
          dateFin: e.dateFin ?? '',
          current: e.current,
          description: e.description,
          ordreAffichage: e.ordreAffichage,
        });
        this.realisations.set([...e.realisations]);
        this.stack.set([...e.stack]);
        if (e.current) {
          this.form.get('dateFin')?.disable();
        }
      });
    }
  }

  protected isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.touched && ctrl.invalid);
  }

  protected onCurrentChange(): void {
    const dateFinCtrl = this.form.get('dateFin');
    if (this.form.value.current) {
      dateFinCtrl?.setValue('');
      dateFinCtrl?.disable();
    } else {
      dateFinCtrl?.enable();
    }
  }

  addRealisation(event: MatChipInputEvent): void {
    const value = (event.value ?? '').trim();
    if (value) {
      this.realisations.update((current) => [...current, value]);
    }
    event.chipInput?.clear();
  }

  removeRealisation(item: string): void {
    this.realisations.update((current) => current.filter((r) => r !== item));
  }

  addStack(event: MatChipInputEvent): void {
    const value = (event.value ?? '').trim();
    if (value && !this.stack().includes(value)) {
      this.stack.update((current) => [...current, value]);
    }
    event.chipInput?.clear();
  }

  removeStack(item: string): void {
    this.stack.update((current) => current.filter((s) => s !== item));
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const data = {
      entreprise: this.form.value.entreprise!,
      poste: this.form.value.poste!,
      contexte: this.form.value.contexte || undefined,
      dateDebut: this.form.value.dateDebut!,
      dateFin: this.form.value.current ? null : this.form.getRawValue().dateFin || null,
      description: this.form.value.description!,
      realisations: this.realisations(),
      stack: this.stack(),
      ordreAffichage: this.form.value.ordreAffichage ?? 0,
    };

    const request$ = this.id
      ? this.experienceService.updateExperience(Number(this.id), data)
      : this.experienceService.createExperience(data);

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
