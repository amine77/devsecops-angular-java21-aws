import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import gsap from 'gsap';

import { LoadingSpinnerComponent } from '@shared/components/loading-spinner/loading-spinner.component';
import { ScrollRevealDirective } from '@shared/directives/scroll-reveal.directive';
import { ScrollAnimationService } from '@core/animation/scroll-animation.service';
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
          @for (group of skillGroups(); track group.category) {
            <div class="skill-group">
              <h2 class="skill-group__title">
                <span class="skill-group__icon" aria-hidden="true">{{
                  categoryIcon(group.category)
                }}</span>
                {{ categoryLabel(group.category) | translate }}
              </h2>
              <div class="grid-skills">
                @for (skill of group.skills; track skill.id) {
                  <div class="skill-card card">
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
export class SkillsComponent implements OnInit, OnDestroy {
  private readonly skillService = inject(SkillService);
  private readonly scrollAnim = inject(ScrollAnimationService);
  private readonly ngZone = inject(NgZone);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly skills = signal<Skill[]>([]);
  protected readonly isLoading = signal(true);

  private groupsTl?: gsap.core.Timeline;

  protected readonly skillGroups = computed(() => {
    const grouped = new Map<SkillCategory, Skill[]>();
    for (const skill of this.skills()) {
      const cat = skill.category;
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(skill);
    }
    return Array.from(grouped.entries()).map(([category, s]) => ({ category, skills: s }));
  });

  constructor() {
    // Les groupes/cartes sont insérés après le chargement HTTP asynchrone : ScrollTrigger
    // ne se déclenche pas pour un élément déjà présent dans le viewport à ce moment-là,
    // on les anime donc directement (même pattern que ProjectListComponent/ExperienceComponent).
    effect(() => {
      const loading = this.isLoading();
      const groups = this.skillGroups();
      if (loading || groups.length === 0 || this.scrollAnim.reducedMotion) return;

      untracked(() => {
        this.ngZone.runOutsideAngular(() => {
          setTimeout(() => {
            this.groupsTl?.kill();
            const nativeEl = this.el.nativeElement;
            const skillGroupEls = Array.from(
              nativeEl.querySelectorAll<HTMLElement>('.skill-group')
            );
            const skillCardEls = Array.from(nativeEl.querySelectorAll<HTMLElement>('.skill-card'));
            if (!skillGroupEls.length) return;
            this.groupsTl = gsap.timeline();
            this.groupsTl.fromTo(
              skillGroupEls,
              { opacity: 0, x: -32 },
              { opacity: 1, x: 0, duration: 0.6, ease: 'power3.out', stagger: 0.08 }
            );
            if (skillCardEls.length) {
              this.groupsTl.fromTo(
                skillCardEls,
                { opacity: 0, y: 16 },
                { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out', stagger: 0.03 },
                '<0.1'
              );
            }
          }, 0);
        });
      });
    });
  }

  ngOnInit(): void {
    this.skillService.getAllSkills().subscribe({
      next: (data) => {
        this.skills.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  ngOnDestroy(): void {
    this.groupsTl?.kill();
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
