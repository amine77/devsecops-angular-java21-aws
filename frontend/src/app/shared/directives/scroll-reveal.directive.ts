import { Directive, ElementRef, Input, OnDestroy, OnInit, inject } from '@angular/core';
import type { ScrollTrigger } from 'gsap/ScrollTrigger';

import {
  RevealDirection,
  RevealEffect,
  ScrollAnimationService,
} from '@core/animation/scroll-animation.service';

/**
 * Reveal au scroll pour les motifs répétitifs (cartes, listes, grilles).
 * Pour les moments uniques (hero, transitions de page), utiliser ScrollAnimationService directement.
 */
@Directive({
  selector: '[appScrollReveal]',
})
export class ScrollRevealDirective implements OnInit, OnDestroy {
  private readonly el: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly scrollAnim = inject(ScrollAnimationService);
  private trigger: ScrollTrigger | null = null;

  @Input() revealDelay = 0;
  @Input() revealDirection: RevealDirection = 'up';
  @Input() revealDistance = 32;
  @Input() revealEffect: RevealEffect = 'fade';

  ngOnInit(): void {
    this.trigger = this.scrollAnim.reveal(this.el.nativeElement, {
      delay: this.revealDelay,
      direction: this.revealDirection,
      distance: this.revealDistance,
      effect: this.revealEffect,
    });
  }

  ngOnDestroy(): void {
    this.trigger?.kill();
  }
}
