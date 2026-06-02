import { ChangeDetectionStrategy, Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ProjectService } from '@core/services/project.service';
import { SkillService } from '@core/services/skill.service';
import { LanguageService } from '@core/services/language.service';
import { TranslatePipe } from '@core/pipes/translate.pipe';
import { Skill } from '@shared/models/skill.model';

@Component({
  selector: 'app-project-form',
  standalone: true,
  imports: [
    TranslatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatChipsModule,
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
            {{ (isEditMode ? 'admin.form.title.edit' : 'admin.form.title.create') | translate }}
          </h1>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="project-form">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'admin.form.field.title' | translate }}</mat-label>
            <input matInput formControlName="title" placeholder="Mon super projet" />
            @if (isInvalid('title')) {
              <mat-error>{{ 'admin.form.field.title.error' | translate }}</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'admin.form.field.summary' | translate }}</mat-label>
            <input matInput formControlName="summary" placeholder="Affiché sur les cards..." />
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'admin.form.field.description' | translate }}</mat-label>
            <textarea matInput formControlName="description" rows="6"></textarea>
            @if (isInvalid('description')) {
              <mat-error>{{ 'admin.form.field.description.error' | translate }}</mat-error>
            }
          </mat-form-field>

          <div class="form-row">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ 'admin.form.field.github' | translate }}</mat-label>
              <input matInput formControlName="githubUrl" placeholder="https://github.com/..." />
              <mat-icon matPrefix>code</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ 'admin.form.field.demo' | translate }}</mat-label>
              <input matInput formControlName="demoUrl" placeholder="https://..." />
              <mat-icon matPrefix>open_in_new</mat-icon>
            </mat-form-field>
          </div>

          <mat-checkbox formControlName="featured" color="primary">
            Mettre en vedette (homepage)
          </mat-checkbox>

          @if (allSkills().length > 0) {
            <div class="skills-section">
              <p class="skills-label">Compétences associées</p>
              <mat-chip-listbox class="skills-chips">
                @for (skill of allSkills(); track skill.id) {
                  <mat-chip-option
                    [value]="skill.id"
                    [selected]="isSkillSelected(skill.id)"
                    (selectionChange)="onSkillChange(skill.id, $event.selected)"
                  >
                    {{ skill.name }}
                  </mat-chip-option>
                }
              </mat-chip-listbox>
            </div>
          }

          @if (errorMessage()) {
            <div class="form-error-banner">
              <mat-icon>error_outline</mat-icon>
              {{ errorMessage() }}
            </div>
          }

          <div class="form-actions">
            <a routerLink="/admin" mat-button>Annuler</a>
            <button mat-raised-button color="primary" type="submit" [disabled]="isLoading()">
              @if (isLoading()) {
                <mat-progress-spinner mode="indeterminate" diameter="18" />
              }
              {{ isLoading() ? 'Sauvegarde...' : 'Sauvegarder' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [
    `
      .container--narrow {
        max-width: 720px;
      }
      .form-header {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1.5rem;
      }
      .project-form {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .full-width {
        width: 100%;
      }
      .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }
      .skills-section {
        margin: 0.5rem 0;
      }
      .skills-label {
        font-size: 0.875rem;
        color: var(--color-text-secondary);
        margin-bottom: 0.5rem;
      }
      .skills-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
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
      @media (max-width: 600px) {
        .form-row {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class ProjectFormComponent implements OnInit {
  @Input() id?: string;

  private readonly fb = inject(FormBuilder);
  private readonly projectService = inject(ProjectService);
  private readonly skillService = inject(SkillService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly lang = inject(LanguageService);

  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly allSkills = signal<Skill[]>([]);
  private readonly selectedSkillIds = signal<number[]>([]);

  protected get isEditMode(): boolean {
    return !!this.id;
  }

  protected readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    description: ['', [Validators.required, Validators.minLength(10)]],
    summary: [''],
    githubUrl: [''],
    demoUrl: [''],
    imageUrl: [''],
    featured: [false],
    sortOrder: [0],
  });

  ngOnInit(): void {
    this.skillService.getAllSkills().subscribe((s) => this.allSkills.set(s));

    if (this.id) {
      this.projectService.getProjectById(Number(this.id)).subscribe((p) => {
        this.form.patchValue({
          title: p.title,
          description: p.description,
          summary: p.summary ?? '',
          githubUrl: p.githubUrl ?? '',
          demoUrl: p.demoUrl ?? '',
          imageUrl: p.imageUrl ?? '',
          featured: p.featured,
          sortOrder: p.sortOrder,
        });
        this.selectedSkillIds.set(p.skills.map((s) => s.id));
      });
    }
  }

  protected isSkillSelected(id: number): boolean {
    return this.selectedSkillIds().includes(id);
  }

  protected onSkillChange(id: number, selected: boolean): void {
    this.selectedSkillIds.update((ids) => (selected ? [...ids, id] : ids.filter((i) => i !== id)));
  }

  protected isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.touched && ctrl.invalid);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const data = { ...this.form.value, skillIds: this.selectedSkillIds() } as never;

    const request$ = this.id
      ? this.projectService.updateProject(Number(this.id), data)
      : this.projectService.createProject(data);

    request$.subscribe({
      next: () => {
        this.snackBar.open(this.lang.translate('admin.form.saved'), 'OK', { duration: 3000 });
        void this.router.navigate(['/admin']);
      },
      error: () => {
        this.errorMessage.set(this.lang.translate('admin.form.error'));
        this.isLoading.set(false);
      },
    });
  }
}
