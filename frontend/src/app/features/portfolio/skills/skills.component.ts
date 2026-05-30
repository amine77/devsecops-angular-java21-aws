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
  imports: [LoadingSpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="section skills-page">
      <div class="container">
        <h1 class="section-title">Compétences</h1>
        <p class="section-subtitle">Technologies et outils maîtrisés</p>

        @if (isLoading()) {
          <app-loading-spinner message="Chargement..." />
        } @else {
          @for (group of skillGroups(); track group.category) {
            <div class="skill-group">
              <h2 class="skill-group__title">
                <span class="skill-group__icon" aria-hidden="true">{{
                  categoryIcon(group.category)
                }}</span>
                {{ categoryLabel(group.category) }}
              </h2>
              <div class="grid-skills">
                @for (skill of group.skills; track skill.id) {
                  <div class="skill-card card">
                    <div class="skill-card__header">
                      <span class="skill-card__name">{{ skill.name }}</span>
                      <span class="skill-card__pct">{{ skill.level * 20 }}%</span>
                    </div>
                    <div
                      class="skill-card__bar-track"
                      role="progressbar"
                      [attr.aria-valuenow]="skill.level * 20"
                      aria-valuemin="0"
                      aria-valuemax="100"
                      [attr.aria-label]="skill.name + ' — niveau ' + skill.level + ' sur 5'"
                    >
                      <div class="skill-card__bar-fill" [style.width.%]="skill.level * 20"></div>
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
  styles: [
    `
      .skill-group {
        margin-bottom: var(--spacing-2xl);
      }
      .skill-group__title {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        font-size: var(--font-size-xl);
        color: var(--color-text-primary);
        margin-bottom: var(--spacing-lg);
        font-family: var(--font-mono);
        font-weight: 600;
      }
      .skill-group__icon {
        font-size: 1.25rem;
      }
      .skill-card {
        padding: var(--spacing-md);
        display: flex;
        flex-direction: column;
        gap: var(--spacing-sm);
      }
      .skill-card__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .skill-card__name {
        font-weight: 600;
        font-size: var(--font-size-sm);
        color: var(--color-text-primary);
      }
      .skill-card__pct {
        font-family: var(--font-mono);
        font-size: var(--font-size-xs);
        color: var(--color-accent);
        font-weight: 600;
      }
      .skill-card__bar-track {
        height: 4px;
        background: var(--color-bg-tertiary);
        border-radius: var(--radius-full);
        overflow: hidden;
      }
      .skill-card__bar-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--color-accent), #818cf8);
        border-radius: var(--radius-full);
        transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
      }
    `,
  ],
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

  private static readonly CATEGORY_ICONS: Record<SkillCategory, string> = {
    BACKEND: '⚙️',
    FRONTEND: '🎨',
    DEVOPS: '🔄',
    CLOUD: '☁️',
    OTHER: '🔧',
  };

  protected categoryIcon(cat: SkillCategory): string {
    return SkillsComponent.CATEGORY_ICONS[cat] ?? '🔧';
  }
}
