import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';

import { LoadingSpinnerComponent } from '@shared/components/loading-spinner/loading-spinner.component';
import { SkillService } from '@core/services/skill.service';
import { Skill, SkillCategory, SKILL_CATEGORY_LABELS } from '@shared/models/skill.model';

/**
 * Page des compétences.
 *
 * Groupe les compétences par catégorie.
 * Utilise computed() pour dériver automatiquement les groupes
 * depuis le signal skills — pas de logique de transformation dans le template.
 */
@Component({
  selector: 'app-skills',
  standalone: true,
  imports: [LoadingSpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="section">
      <div class="container">
        <h1 class="section-title">Compétences</h1>
        <p class="section-subtitle">Technologies et outils maîtrisés</p>

        @if (isLoading()) {
          <app-loading-spinner message="Chargement..." />
        } @else {
          @for (group of skillGroups(); track group.category) {
            <div class="skill-group">
              <h2 class="skill-group__title">
                {{ categoryLabel(group.category) }}
              </h2>
              <div class="grid-skills">
                @for (skill of group.skills; track skill.id) {
                  <div class="skill-card card">
                    <div class="skill-card__name">{{ skill.name }}</div>
                    <div class="skill-card__level" [attr.aria-label]="'Niveau ' + skill.level + ' sur 5'">
                      @for (i of [1,2,3,4,5]; track i) {
                        <span
                          class="skill-card__dot"
                          [class.skill-card__dot--active]="i <= skill.level"
                        ></span>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .skill-group {
      margin-bottom: var(--spacing-2xl);
      &__title {
        font-size: var(--font-size-xl);
        color: var(--color-accent);
        margin-bottom: var(--spacing-lg);
        font-family: var(--font-mono);
        &::before { content: '// '; color: var(--color-text-muted); }
      }
    }
    .skill-card {
      padding: var(--spacing-md);
      display: flex;
      flex-direction: column;
      gap: var(--spacing-sm);
      &__name {
        font-weight: 600;
        font-size: var(--font-size-sm);
        color: var(--color-text-primary);
      }
      &__level {
        display: flex;
        gap: 4px;
      }
      &__dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--color-bg-tertiary);
        &--active { background: var(--color-accent); }
      }
    }
  `],
})
export class SkillsComponent implements OnInit {
  private readonly skillService = inject(SkillService);

  private readonly skills = signal<Skill[]>([]);
  protected readonly isLoading = signal(true);

  /** Computed : groupe les skills par catégorie automatiquement. */
  protected readonly skillGroups = computed(() => {
    const grouped = new Map<SkillCategory, Skill[]>();
    for (const skill of this.skills()) {
      const cat = skill.category;
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(skill);
    }
    return Array.from(grouped.entries()).map(([category, s]) => ({ category, skills: s }));
  });

  ngOnInit(): void {
    this.skillService.getAllSkills().subscribe({
      next: (data) => {
        this.skills.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  protected categoryLabel(cat: SkillCategory): string {
    return SKILL_CATEGORY_LABELS[cat] ?? cat;
  }
}
