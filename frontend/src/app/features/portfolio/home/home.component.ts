import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { ProjectCardComponent } from '@shared/components/project-card/project-card.component';
import { ArticleCardComponent } from '@shared/components/article-card/article-card.component';
import { LoadingSpinnerComponent } from '@shared/components/loading-spinner/loading-spinner.component';
import { ScrollRevealDirective } from '@shared/directives/scroll-reveal.directive';
import { LanguageService } from '@core/services/language.service';
import { ProjectService } from '@core/services/project.service';
import { ArticleService } from '@core/services/article.service';
import { ScrollAnimationService } from '@core/animation/scroll-animation.service';
import { Project } from '@shared/models/project.model';
import { Article } from '@shared/models/article.model';
import { TranslatePipe } from '@core/pipes/translate.pipe';

/**
 * Page d'accueil du portfolio.
 *
 * Affiche :
 * - Section hero (présentation) avec entrée animée GSAP + parallax + scroll-progress
 * - Projets en vedette (featured) avec reveal "déploiement" en cascade
 * - Stats avec compteurs animés au scroll
 *
 * Utilise des Signals pour l'état asynchrone :
 * - projects() : liste des projets featured
 * - isLoading() : état de chargement
 * - error() : message d'erreur
 *
 * Pattern moderne Angular 18 :
 * Pas de AsyncPipe ni de subscribe manuel dans le template.
 * Le signal est mis à jour dans le callback next/error de subscribe.
 */
@Component({
  selector: 'app-home',
  imports: [
    RouterLink,
    ProjectCardComponent,
    ArticleCardComponent,
    LoadingSpinnerComponent,
    TranslatePipe,
    ScrollRevealDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly projectService = inject(ProjectService);
  private readonly articleService = inject(ArticleService);
  private readonly lang = inject(LanguageService);
  private readonly scrollAnim = inject(ScrollAnimationService);

  private readonly scrollProgressRef = viewChild<ElementRef<HTMLElement>>('scrollProgress');
  private readonly heroSectionRef = viewChild<ElementRef<HTMLElement>>('heroSection');
  private readonly heroContentRef = viewChild<ElementRef<HTMLElement>>('heroContent');
  private readonly heroTitleRef = viewChild<ElementRef<HTMLElement>>('heroTitle');
  private readonly heroTerminalRef = viewChild<ElementRef<HTMLElement>>('heroTerminal');
  private readonly statsSectionRef = viewChild<ElementRef<HTMLElement>>('statsSection');

  private readonly triggers: ScrollTrigger[] = [];
  private heroTimeline: gsap.core.Timeline | null = null;

  protected readonly featuredProjects = signal<Project[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly latestArticles = signal<Article[]>([]);
  protected readonly isLoadingArticles = signal(true);
  protected readonly articlesError = signal<string | null>(null);

  protected readonly techStack = [
    'Angular 21',
    'Spring Boot',
    'Java 21',
    'PostgreSQL',
    'Docker',
    'Kubernetes',
    'Helm',
    'Terraform',
    'AWS',
    'GitHub Actions',
  ];

  /** Passe à true une fois frontend/src/assets/cv-amine-charrad.pdf ajouté au dépôt. */
  protected readonly cvAvailable = false;

  protected readonly stats = signal([
    { value: '12', key: 'home.stat.experience' },
    { value: '10+', key: 'home.stat.technologies' },
    { value: '5', key: 'home.stat.articles' },
    { value: '100%', key: 'home.stat.iac' },
  ]);

  ngOnInit(): void {
    this.loadFeaturedProjects();
    this.loadLatestArticles();
  }

  ngAfterViewInit(): void {
    if (this.scrollAnim.reducedMotion) {
      return;
    }
    this.setupScrollProgress();
    this.setupHeroEntrance();
    this.setupOrbParallax();
    this.setupHeroScrubFade();
    this.setupStatsCounters();
  }

  ngOnDestroy(): void {
    this.heroTimeline?.kill();
    this.triggers.forEach((trigger) => trigger.kill());
  }

  protected retryLoad(): void {
    this.error.set(null);
    this.isLoading.set(true);
    this.loadFeaturedProjects();
  }

  protected retryArticlesLoad(): void {
    this.articlesError.set(null);
    this.isLoadingArticles.set(true);
    this.loadLatestArticles();
  }

  private loadFeaturedProjects(): void {
    this.projectService.getFeaturedProjects().subscribe({
      next: (projects) => {
        this.featuredProjects.set(projects);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set(this.lang.translate('home.featured.error'));
        this.isLoading.set(false);
      },
    });
  }

  private loadLatestArticles(): void {
    this.articleService.getArticles(0, 3).subscribe({
      next: (page) => {
        this.latestArticles.set(page.content);
        this.isLoadingArticles.set(false);
        this.stats.update((current) =>
          current.map((stat) =>
            stat.key === 'home.stat.articles' ? { ...stat, value: `${page.totalElements}` } : stat
          )
        );
      },
      error: () => {
        this.articlesError.set(this.lang.translate('home.latest.error'));
        this.isLoadingArticles.set(false);
      },
    });
  }

  /** Barre de progression de scroll fine, fixée sous la navbar. */
  private setupScrollProgress(): void {
    const bar = this.scrollProgressRef()?.nativeElement;
    if (!bar) {
      return;
    }

    const trigger = ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => {
        bar.style.width = `${self.progress * 100}%`;
      },
    });
    this.triggers.push(trigger);
  }

  /** Révélation du titre par groupes de mots (profondeur) + "frappe" du code du terminal. */
  private setupHeroEntrance(): void {
    const words = this.heroTitleRef()?.nativeElement.querySelectorAll<HTMLElement>('.hero__word');
    const blocks = this.heroTerminalRef()?.nativeElement.querySelectorAll<HTMLElement>('.t-block');
    if (!words?.length && !blocks?.length) {
      return;
    }

    const tl = this.scrollAnim.timeline();
    this.heroTimeline = tl;

    if (words?.length) {
      tl.fromTo(
        words,
        { opacity: 0, y: 36, rotateX: -60 },
        { opacity: 1, y: 0, rotateX: 0, duration: 0.7, stagger: 0.12, ease: 'power3.out' }
      );
    }

    if (blocks?.length) {
      tl.fromTo(
        blocks,
        { clipPath: 'inset(0 100% 0 0)' },
        { clipPath: 'inset(0 0% 0 0)', duration: 1, stagger: 0.4, ease: 'steps(20)' },
        0.3
      );
    }
  }

  /** Parallax des orbes en arrière-plan : vitesses différentes selon la profondeur. */
  private setupOrbParallax(): void {
    const heroSection = this.heroSectionRef()?.nativeElement;
    const orbs = heroSection?.querySelectorAll<HTMLElement>('.hero__orb-parallax');
    if (!heroSection || !orbs?.length) {
      return;
    }

    orbs.forEach((orb, i) => {
      const tween = gsap.to(orb, {
        y: (i + 1) * -70,
        ease: 'none',
        scrollTrigger: {
          trigger: heroSection,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });
      if (tween.scrollTrigger) {
        this.triggers.push(tween.scrollTrigger);
      }
    });
  }

  /** Le hero s'estompe et se réduit légèrement à mesure qu'on défile vers les projets. */
  private setupHeroScrubFade(): void {
    const heroSection = this.heroSectionRef()?.nativeElement;
    const heroContent = this.heroContentRef()?.nativeElement;
    if (!heroSection || !heroContent) {
      return;
    }

    const tween = gsap.to(heroContent, {
      opacity: 0.25,
      scale: 0.94,
      ease: 'none',
      scrollTrigger: {
        trigger: heroSection,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      },
    });
    if (tween.scrollTrigger) {
      this.triggers.push(tween.scrollTrigger);
    }
  }

  /** Compteurs animés de 0 à la valeur finale à l'entrée dans le viewport. */
  private setupStatsCounters(): void {
    const values =
      this.statsSectionRef()?.nativeElement.querySelectorAll<HTMLElement>('.stat-card__value');
    if (!values?.length) {
      return;
    }

    values.forEach((el) => {
      const match = el.textContent?.trim().match(/^([\d.]+)(.*)$/);
      if (!match) {
        return;
      }
      const [, numberPart, suffix] = match;
      const target = parseFloat(numberPart);
      const proxy = { value: 0 };

      const tween = gsap.to(proxy, {
        value: target,
        duration: 1.4,
        ease: 'power2.out',
        onUpdate: () => {
          el.textContent = `${Math.round(proxy.value)}${suffix}`;
        },
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          once: true,
        },
      });
      if (tween.scrollTrigger) {
        this.triggers.push(tween.scrollTrigger);
      }
    });
  }
}
