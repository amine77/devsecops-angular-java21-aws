import { Injectable, NgZone, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export type RevealDirection = 'up' | 'left' | 'right';
export type RevealEffect = 'fade' | 'deploy';

export interface RevealOptions {
  delay?: number;
  direction?: RevealDirection;
  distance?: number;
  effect?: RevealEffect;
  duration?: number;
}

/**
 * Point d'entrée unique pour les animations pilotées par le scroll (GSAP + ScrollTrigger).
 *
 * Responsabilités transverses :
 * - enregistrer le plugin ScrollTrigger une seule fois
 * - exécuter GSAP hors NgZone (évite un change detection à chaque frame de scroll)
 * - respecter prefers-reduced-motion (les consommateurs vérifient `reducedMotion`)
 * - rafraîchir ScrollTrigger après chaque navigation Angular (pas de reload en SPA)
 */
@Injectable({ providedIn: 'root' })
export class ScrollAnimationService {
  private readonly ngZone = inject(NgZone);

  readonly reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    // Le ticker GSAP est un RAF loop global et partagé par toutes les animations de l'app.
    // Il doit démarrer hors zone Angular dès le premier appel, sinon CHAQUE frame de scroll
    // déclenche un change detection complet, même pour des tweens créés plus tard dans la zone.
    this.ngZone.runOutsideAngular(() => {
      gsap.registerPlugin(ScrollTrigger);
      gsap.ticker.add(() => {});
    });
  }

  /** Timeline GSAP exécutée hors zone Angular, pour les animations bespoke par composant. */
  timeline(vars?: gsap.TimelineVars): gsap.core.Timeline {
    let tl!: gsap.core.Timeline;
    this.ngZone.runOutsideAngular(() => {
      tl = gsap.timeline(vars);
    });
    return tl;
  }

  /** Reveal au scroll d'un élément — utilisé par la directive `appScrollReveal`. */
  reveal(element: Element, options: RevealOptions = {}): ScrollTrigger | null {
    if (this.reducedMotion) {
      return null;
    }

    const { delay = 0, direction = 'up', distance = 32, effect = 'fade', duration = 0.7 } = options;

    const from: gsap.TweenVars =
      effect === 'deploy'
        ? { opacity: 0, y: distance, rotateX: -15, scale: 0.92, transformPerspective: 800 }
        : {
            opacity: 0,
            x: direction === 'left' ? -distance : direction === 'right' ? distance : 0,
            y: direction === 'up' ? distance : 0,
          };

    const to: gsap.TweenVars = {
      opacity: 1,
      x: 0,
      y: 0,
      rotateX: 0,
      scale: 1,
      duration,
      delay: delay / 1000,
      ease: 'power3.out',
    };

    // Si l'élément est déjà dans le viewport (ex: cartes chargées async), on anime
    // immédiatement sans attendre un scroll — sinon ScrollTrigger ne déclenche jamais.
    const rect = element.getBoundingClientRect();
    const alreadyVisible = rect.top < window.innerHeight * 0.9;

    let trigger: ScrollTrigger | null = null;
    this.ngZone.runOutsideAngular(() => {
      if (alreadyVisible) {
        gsap.fromTo(element, from, to);
      } else {
        const tween = gsap.fromTo(element, from, {
          ...to,
          scrollTrigger: {
            trigger: element,
            start: 'top 85%',
            once: true,
          },
        });
        trigger = tween.scrollTrigger ?? null;
      }
    });
    return trigger;
  }

  /** À appeler une fois (AppComponent) : ScrollTrigger.refresh() après chaque navigation. */
  refreshOnNavigation(router: Router): void {
    router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.ngZone.runOutsideAngular(() => {
        setTimeout(() => ScrollTrigger.refresh(), 0);
      });
    });
  }
}
