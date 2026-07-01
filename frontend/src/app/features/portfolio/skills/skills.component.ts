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
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { LoadingSpinnerComponent } from '@shared/components/loading-spinner/loading-spinner.component';
import { ScrollRevealDirective } from '@shared/directives/scroll-reveal.directive';
import { ScrollAnimationService } from '@core/animation/scroll-animation.service';
import { SkillService } from '@core/services/skill.service';
import { Skill, SkillCategory, SKILL_CATEGORY_LABELS } from '@shared/models/skill.model';
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
                {{ categoryLabel(group.category) }}
              </h2>
              <div class="grid-skills">
                @for (skill of group.skills; track skill.id; let si = $index) {
                  <div class="skill-card card" appScrollReveal [revealDelay]="gi * 80 + si * 60">
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
                      <div
                        class="skill-card__bar-fill"
                        [attr.data-w]="skill.level * 20"
                      ></div>
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
        width: 0;
        background: linear-gradient(90deg, var(--color-accent), #818cf8);
        border-radius: var(--radius-full);
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
  private readonly barTriggers: ScrollTrigger[] = [];
  private barsAnimated = false;

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
    // Déclencher l'animation des barres dès que les skills sont chargés et rendus
    effect(() => {
      const groups = this.skillGroups();
      if (groups.length > 0 && !this.barsAnimated) {
        this.barsAnimated = true;
        untracked(() => {
          // Laisser Angular rendre le DOM avant de lire les data-w
          setTimeout(() => this.animateBars(), 50);
        });
      }
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
    this.barTriggers.forEach((t) => t.kill());
  }

  private animateBars(): void {
    if (this.scrollAnim.reducedMotion) return;

    this.ngZone.runOutsideAngular(() => {
      const bars = Array.from(
        this.el.nativeElement.querySelectorAll<HTMLElement>('.skill-card__bar-fill'),
      );
      bars.forEach((bar: HTMLElement, i: number) => {
        const targetPct = Number(bar.getAttribute('data-w') ?? 0);
        const trigger = ScrollTrigger.create({
          trigger: bar,
          start: 'top 90%',
          once: true,
          onEnter: () => {
            gsap.to(bar, {
              width: targetPct + '%',
              duration: 0.75,
              delay: (i % 6) * 0.06,
              ease: 'power2.out',
            });
          },
        });
        this.barTriggers.push(trigger);
      });
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
