import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import gsap from 'gsap';

import { LoadingSpinnerComponent } from '@shared/components/loading-spinner/loading-spinner.component';
import { ScrollRevealDirective } from '@shared/directives/scroll-reveal.directive';
import { ScrollAnimationService } from '@core/animation/scroll-animation.service';
import { ExperienceService } from '@core/services/experience.service';
import { Experience } from '@shared/models/experience.model';
import { formatExperiencePeriod } from '@shared/utils/experience-period.util';
import { LanguageService } from '@core/services/language.service';
import { TranslatePipe } from '@core/pipes/translate.pipe';

@Component({
  selector: 'app-experience',
  imports: [LoadingSpinnerComponent, ScrollRevealDirective, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="section experience-page">
      <div class="container">
        <h1 class="section-title" appScrollReveal [revealDelay]="0">
          {{ 'experience.title' | translate }}
        </h1>
        <p class="section-subtitle" appScrollReveal [revealDelay]="120">
          {{ 'experience.subtitle' | translate }}
        </p>

        @if (isLoading()) {
          <app-loading-spinner [message]="'experience.loading' | translate" [fullPage]="true" />
        } @else if (error()) {
          <div class="error-state">
            <div class="error-state__icon" aria-hidden="true">⚠</div>
            <p>{{ error() }}</p>
            <button class="btn btn-outline" (click)="loadExperiences()">
              {{ 'experience.retry' | translate }}
            </button>
          </div>
        } @else if (experiences().length === 0) {
          <div class="empty-state">
            <p>{{ 'experience.empty' | translate }}</p>
          </div>
        } @else {
          <div class="timeline">
            @for (exp of experiences(); track exp.id) {
              <article class="timeline-item card">
                <div class="timeline-item__header">
                  <div>
                    <h2 class="timeline-item__company">{{ exp.entreprise }}</h2>
                    <p class="timeline-item__role">{{ exp.poste }}</p>
                  </div>
                  <div class="timeline-item__period">
                    <span>{{ periodLabel(exp) }}</span>
                    @if (exp.current) {
                      <span class="badge badge-green">{{ 'experience.current' | translate }}</span>
                    }
                  </div>
                </div>

                @if (exp.contexte) {
                  <p class="timeline-item__context">{{ exp.contexte }}</p>
                }

                <p class="timeline-item__description">{{ exp.description }}</p>

                @if (exp.realisations.length > 0) {
                  <ul class="timeline-item__achievements">
                    @for (item of exp.realisations; track item) {
                      <li>{{ item }}</li>
                    }
                  </ul>
                }

                @if (exp.stack.length > 0) {
                  <div class="timeline-item__stack">
                    @for (tech of exp.stack; track tech) {
                      <span class="badge badge-blue">{{ tech }}</span>
                    }
                  </div>
                }
              </article>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .timeline {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-xl);
      }
      .timeline-item {
        padding: var(--spacing-xl);
      }
      .timeline-item__header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: var(--spacing-md);
        flex-wrap: wrap;
        margin-bottom: var(--spacing-sm);
      }
      .timeline-item__company {
        font-size: var(--font-size-xl);
        color: var(--color-text-primary);
        font-family: var(--font-mono);
        font-weight: 600;
      }
      .timeline-item__role {
        color: var(--color-accent);
        font-size: var(--font-size-md);
        font-weight: 500;
      }
      .timeline-item__period {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
        white-space: nowrap;
      }
      .timeline-item__context {
        color: var(--color-text-muted);
        font-size: var(--font-size-sm);
        font-style: italic;
        margin-bottom: var(--spacing-md);
      }
      .timeline-item__description {
        color: var(--color-text-secondary);
        margin-bottom: var(--spacing-md);
        line-height: 1.6;
      }
      .timeline-item__achievements {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-xs);
        margin-bottom: var(--spacing-md);
        padding-left: 1.25rem;
        color: var(--color-text-secondary);
        line-height: 1.5;
      }
      .timeline-item__achievements li {
        list-style: disc;
      }
      .timeline-item__stack {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-xs);
      }
      .error-state,
      .empty-state {
        text-align: center;
        padding: var(--spacing-3xl);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--spacing-md);
      }
      .error-state__icon {
        font-size: 2.5rem;
        color: var(--color-warning);
      }
    `,
  ],
})
export class ExperienceComponent implements OnInit, OnDestroy {
  private readonly experienceService = inject(ExperienceService);
  private readonly lang = inject(LanguageService);
  private readonly titleService = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly scrollAnim = inject(ScrollAnimationService);
  private readonly ngZone = inject(NgZone);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly experiences = signal<Experience[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);

  private itemsTl?: gsap.core.Timeline;

  constructor() {
    // Les items du timeline sont insérés après le chargement HTTP asynchrone : ScrollTrigger
    // ne se déclenche pas pour un élément déjà présent dans le viewport à ce moment-là,
    // on les anime donc directement (même pattern que ProjectListComponent).
    effect(() => {
      const data = this.experiences();
      const loading = this.isLoading();
      if (loading || data.length === 0 || this.scrollAnim.reducedMotion) return;

      untracked(() => {
        this.ngZone.runOutsideAngular(() => {
          setTimeout(() => {
            this.itemsTl?.kill();
            const items = Array.from(
              this.el.nativeElement.querySelectorAll<HTMLElement>('.timeline-item')
            );
            if (!items.length) return;
            this.itemsTl = gsap.timeline();
            this.itemsTl.fromTo(
              items,
              { opacity: 0, x: -32 },
              { opacity: 1, x: 0, duration: 0.7, ease: 'power3.out', stagger: 0.1 }
            );
          }, 0);
        });
      });
    });
  }

  ngOnInit(): void {
    this.updateSeo();
    this.loadExperiences();
  }

  ngOnDestroy(): void {
    this.document.getElementById('experience-jsonld')?.remove();
    this.itemsTl?.kill();
  }

  protected loadExperiences(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.experienceService.getExperiences().subscribe({
      next: (data) => {
        this.experiences.set(data);
        this.isLoading.set(false);
        this.updateStructuredData(data);
      },
      error: () => {
        this.error.set(this.lang.translate('experience.error'));
        this.isLoading.set(false);
      },
    });
  }

  protected periodLabel(exp: Experience): string {
    return formatExperiencePeriod(
      exp,
      this.lang.current(),
      this.lang.translate('experience.today')
    );
  }

  private updateSeo(): void {
    const title =
      'Expérience professionnelle — Allianz France, Société Générale Securities Services, Boursorama | Amine Charrad';
    const description =
      "12 ans d'expérience Tech Lead Java / Angular / DevSecOps en grands comptes : Allianz France, Société Générale Securities Services, Boursorama. Java 21, Spring Boot, Angular, Kubernetes, AWS, Terraform, Kafka.";

    this.titleService.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
  }

  private updateStructuredData(experiences: Experience[]): void {
    const current = experiences.find((e) => e.current);
    const past = experiences.filter((e) => !e.current);

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: 'Amine Charrad',
      jobTitle: current?.poste ?? 'Tech Lead Fullstack Java / Angular',
      url: this.document.location.origin,
      ...(current && {
        worksFor: {
          '@type': 'Organization',
          name: current.entreprise,
        },
      }),
      ...(past.length > 0 && {
        alumniOf: past.map((e) => ({
          '@type': 'Organization',
          name: e.entreprise,
        })),
      }),
      knowsAbout: Array.from(new Set(experiences.flatMap((e) => e.stack))),
    };

    let script = this.document.getElementById('experience-jsonld') as HTMLScriptElement | null;
    if (!script) {
      script = this.document.createElement('script');
      script.id = 'experience-jsonld';
      script.type = 'application/ld+json';
      this.document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(jsonLd);
  }
}
