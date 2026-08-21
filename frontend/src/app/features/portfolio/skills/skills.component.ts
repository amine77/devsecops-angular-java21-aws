import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';

import { LoadingSpinnerComponent } from '@shared/components/loading-spinner/loading-spinner.component';
import { ScrollRevealDirective } from '@shared/directives/scroll-reveal.directive';
import { SkillService } from '@core/services/skill.service';
import {
  Skill,
  SkillCategory,
  SkillLevel,
  SKILL_CATEGORY_LABEL_KEYS,
} from '@shared/models/skill.model';
import { TranslatePipe } from '@core/pipes/translate.pipe';

@Component({
  selector: 'app-skills',
  imports: [LoadingSpinnerComponent, ScrollRevealDirective, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="section skills-page">
      <div class="container">
        <h1 class="section-title" appScrollReveal [revealDelay]="0">
          {{ 'skills.title' | translate }}
        </h1>
        <p class="section-subtitle" appScrollReveal [revealDelay]="120">
          {{ 'skills.subtitle' | translate }}
        </p>

        @if (isLoading()) {
          <app-loading-spinner [message]="'skills.loading' | translate" />
        } @else {
          @for (group of skillGroups(); track group.category; let gi = $index) {
            <div class="skill-group" appScrollReveal [revealDelay]="gi * 80" revealDirection="left">
              <h2 class="skill-group__title">
                <span class="skill-group__icon" aria-hidden="true">{{
                  categoryIcon(group.category)
                }}</span>
                {{ categoryLabel(group.category) | translate }}
              </h2>
              <div class="grid-skills">
                @for (skill of group.skills; track skill.id; let si = $index) {
                  <div class="skill-card card" appScrollReveal [revealDelay]="gi * 80 + si * 60">
                    <span class="skill-card__name">{{ skill.name }}</span>
                    <span
                      class="skill-card__level"
                      [class]="'skill-card__level--' + skill.level.toLowerCase()"
                    >
                      <span class="skill-card__dot" aria-hidden="true"></span>
                      {{ levelLabel(skill.level) | translate }}
                    </span>
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
        align-items: center;
        justify-content: space-between;
        gap: var(--spacing-sm);
      }
      .skill-card__name {
        font-weight: 600;
        font-size: var(--font-size-sm);
        color: var(--color-text-primary);
      }
      .skill-card__level {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: var(--font-size-xs);
        font-weight: 600;
        white-space: nowrap;
      }
      .skill-card__dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .skill-card__level--expert {
        color: var(--color-success);
      }
      .skill-card__level--expert .skill-card__dot {
        background: var(--color-success);
      }
      .skill-card__level--avance {
        color: var(--color-accent);
      }
      .skill-card__level--avance .skill-card__dot {
        background: var(--color-accent);
      }
      .skill-card__level--intermediaire {
        color: var(--color-text-muted);
      }
      .skill-card__level--intermediaire .skill-card__dot {
        background: var(--color-text-muted);
      }
    `,
  ],
})
export class SkillsComponent implements OnInit {
  private readonly skillService = inject(SkillService);

  private readonly skills = signal<Skill[]>([]);
  protected readonly isLoading = signal(true);

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
    return SKILL_CATEGORY_LABEL_KEYS[cat] ?? cat;
  }

  private static readonly CATEGORY_ICONS: Record<SkillCategory, string> = {
    BACKEND: '⚙️',
    FRONTEND: '🎨',
    CLOUD_DEVOPS: '☁️',
    QUALITY: '✅',
    OTHER: '🔧',
  };

  protected categoryIcon(cat: SkillCategory): string {
    return SkillsComponent.CATEGORY_ICONS[cat] ?? '🔧';
  }

  private static readonly LEVEL_LABEL_KEYS: Record<SkillLevel, string> = {
    EXPERT: 'skills.level.expert',
    AVANCE: 'skills.level.avance',
    INTERMEDIAIRE: 'skills.level.intermediaire',
  };

  protected levelLabel(level: SkillLevel): string {
    return SkillsComponent.LEVEL_LABEL_KEYS[level] ?? level;
  }
}
