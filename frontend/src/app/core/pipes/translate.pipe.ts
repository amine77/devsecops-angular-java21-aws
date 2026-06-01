import {
  ChangeDetectorRef,
  DestroyRef,
  OnInit,
  Pipe,
  PipeTransform,
  effect,
  inject,
} from '@angular/core';

import { LanguageService } from '@core/services/language.service';

@Pipe({ name: 'translate', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform, OnInit {
  private readonly languageService = inject(LanguageService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    const cleanup = effect(() => {
      // Re-déclencher le pipe quand la langue change
      this.languageService.current();
      this.cdr.markForCheck();
    });
    this.destroyRef.onDestroy(() => cleanup.destroy());
  }

  transform(key: string): string {
    return this.languageService.translate(key);
  }
}
