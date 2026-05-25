import { ChangeDetectionStrategy, Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ProjectService } from '@core/services/project.service';
import { SkillService } from '@core/services/skill.service';
import { Skill } from '@shared/models/skill.model';

/**
 * Formulaire de création / modification d'un projet.
 * Réutilisable : si @Input() id est présent → mode édition, sinon → mode création.
 */
@Component({
  selector: 'app-project-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="section">
      <div class="container container--narrow">
        <div class="form-header">
          <a routerLink="/admin" class="btn btn-ghost">← Retour</a>
          <h1>{{ isEditMode ? 'Modifier le projet' : 'Nouveau projet' }}</h1>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="card project-form">

          <div class="form-group">
            <label for="title" class="form-label">Titre *</label>
            <input id="title" type="text" formControlName="title"
                   class="form-control" [class.is-invalid]="isInvalid('title')" />
            @if (isInvalid('title')) {
              <span class="form-error">Le titre est obligatoire (2-200 caractères)</span>
            }
          </div>

          <div class="form-group">
            <label for="summary" class="form-label">Résumé court</label>
            <input id="summary" type="text" formControlName="summary"
                   class="form-control" placeholder="Affiché sur les cards..." />
          </div>

          <div class="form-group">
            <label for="description" class="form-label">Description complète *</label>
            <textarea id="description" formControlName="description"
                      class="form-control" rows="6"
                      [class.is-invalid]="isInvalid('description')"></textarea>
            @if (isInvalid('description')) {
              <span class="form-error">Description obligatoire (10-5000 caractères)</span>
            }
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="githubUrl" class="form-label">URL GitHub</label>
              <input id="githubUrl" type="url" formControlName="githubUrl" class="form-control"
                     placeholder="https://github.com/..." />
            </div>
            <div class="form-group">
              <label for="demoUrl" class="form-label">URL Démo</label>
              <input id="demoUrl" type="url" formControlName="demoUrl" class="form-control"
                     placeholder="https://..." />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Options</label>
            <label class="checkbox-label">
              <input type="checkbox" formControlName="featured" />
              <span>Mettre en vedette (homepage)</span>
            </label>
          </div>

          <!-- Skills selection -->
          @if (allSkills().length > 0) {
            <div class="form-group">
              <label class="form-label">Compétences associées</label>
              <div class="skills-grid">
                @for (skill of allSkills(); track skill.id) {
                  <label class="skill-checkbox">
                    <input
                      type="checkbox"
                      [value]="skill.id"
                      [checked]="isSkillSelected(skill.id)"
                      (change)="toggleSkill(skill.id, $event)"
                    />
                    <span>{{ skill.name }}</span>
                  </label>
                }
              </div>
            </div>
          }

          @if (errorMessage()) {
            <div class="alert alert-error">{{ errorMessage() }}</div>
          }

          <div class="form-actions">
            <a routerLink="/admin" class="btn btn-ghost">Annuler</a>
            <button type="submit" class="btn btn-primary" [disabled]="isLoading()">
              @if (isLoading()) { Sauvegarde... } @else { Sauvegarder }
            </button>
          </div>

        </form>
      </div>
    </div>
  `,
  styles: [`
    .container--narrow { max-width: 720px; }
    .form-header { display: flex; align-items: center; gap: var(--spacing-lg); margin-bottom: var(--spacing-xl); }
    .project-form { display: flex; flex-direction: column; gap: var(--spacing-lg); padding: var(--spacing-2xl); }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-lg); }
    textarea.form-control { resize: vertical; }
    .checkbox-label { display: flex; align-items: center; gap: var(--spacing-sm); cursor: pointer; font-size: var(--font-size-sm); }
    .skills-grid { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); }
    .skill-checkbox { display: flex; align-items: center; gap: var(--spacing-xs); padding: 0.375rem 0.75rem; background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: var(--radius-full); cursor: pointer; font-size: var(--font-size-xs); transition: all var(--transition-fast); &:hover { border-color: var(--color-accent); } }
    .form-actions { display: flex; justify-content: flex-end; gap: var(--spacing-md); }
    .alert { padding: var(--spacing-sm) var(--spacing-md); border-radius: var(--radius-md); font-size: var(--font-size-sm); }
    .alert-error { background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.3); color: #fca5a5; }
  `],
})
export class ProjectFormComponent implements OnInit {
  @Input() id?: string;

  private readonly fb = inject(FormBuilder);
  private readonly projectService = inject(ProjectService);
  private readonly skillService = inject(SkillService);
  private readonly router = inject(Router);

  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly allSkills = signal<Skill[]>([]);
  private selectedSkillIds = signal<number[]>([]);

  protected get isEditMode(): boolean { return !!this.id; }

  protected readonly form = this.fb.group({
    title:       ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    description: ['', [Validators.required, Validators.minLength(10)]],
    summary:     [''],
    githubUrl:   [''],
    demoUrl:     [''],
    imageUrl:    [''],
    featured:    [false],
    sortOrder:   [0],
  });

  ngOnInit(): void {
    this.skillService.getAllSkills().subscribe((s) => this.allSkills.set(s));

    if (this.id) {
      this.projectService.getProjectById(Number(this.id)).subscribe((p) => {
        this.form.patchValue({
          title: p.title, description: p.description, summary: p.summary ?? '',
          githubUrl: p.githubUrl ?? '', demoUrl: p.demoUrl ?? '',
          imageUrl: p.imageUrl ?? '', featured: p.featured, sortOrder: p.sortOrder,
        });
        this.selectedSkillIds.set(p.skills.map((s) => s.id));
      });
    }
  }

  protected isSkillSelected(id: number): boolean {
    return this.selectedSkillIds().includes(id);
  }

  protected toggleSkill(id: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedSkillIds.update((ids) =>
      checked ? [...ids, id] : ids.filter((i) => i !== id)
    );
  }

  protected isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.touched && ctrl.invalid);
  }

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const data = { ...this.form.value, skillIds: this.selectedSkillIds() } as never;

    const request$ = this.id
      ? this.projectService.updateProject(Number(this.id), data)
      : this.projectService.createProject(data);

    request$.subscribe({
      next: () => void this.router.navigate(['/admin']),
      error: () => {
        this.errorMessage.set('Erreur lors de la sauvegarde.');
        this.isLoading.set(false);
      },
    });
  }
}
