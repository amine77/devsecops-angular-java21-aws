import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type Language = 'fr' | 'en' | 'de';

export interface LanguageOption {
  code: Language;
  label: string;
  flagSrc: string;
}

// 'de' reste un Language valide (fichier assets/i18n/de.json conservé, relecture
// désactivée) mais n'est plus proposé dans le sélecteur : voir getSavedLang().
export const LANGUAGES: LanguageOption[] = [
  { code: 'fr', label: 'Français', flagSrc: 'assets/flags/fr.svg' },
  { code: 'en', label: 'English', flagSrc: 'assets/flags/en.svg' },
];

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly http = inject(HttpClient);

  private readonly _current = signal<Language>(this.getSavedLang());
  private readonly _translations = signal<Record<string, string>>({});

  readonly current: Signal<Language> = this._current.asReadonly();
  readonly currentOption = computed(
    () => LANGUAGES.find((l) => l.code === this._current()) ?? LANGUAGES[0]
  );

  constructor() {
    this.loadTranslations(this._current());
  }

  setLanguage(lang: Language): void {
    this._current.set(lang);
    localStorage.setItem('lang', lang);
    this.loadTranslations(lang);
  }

  translate(key: string): string {
    return this._translations()[key] ?? key;
  }

  private loadTranslations(lang: Language): void {
    this.http.get<Record<string, string>>(`/assets/i18n/${lang}.json`).subscribe({
      next: (data) => this._translations.set(data),
      error: () => this._translations.set({}),
    });
  }

  private getSavedLang(): Language {
    const saved = localStorage.getItem('lang');
    if (saved && LANGUAGES.some((l) => l.code === saved)) {
      return saved as Language;
    }
    // Ancienne préférence 'de' persistée avant le retrait de l'allemand du
    // sélecteur, ou navigateur configuré en allemand : on bascule sur l'anglais
    // plutôt que le français par défaut.
    if (saved === 'de' || this.prefersGerman()) {
      return 'en';
    }
    return 'fr';
  }

  private prefersGerman(): boolean {
    const navLang = typeof navigator !== 'undefined' ? navigator.language : '';
    return (navLang ?? '').toLowerCase().startsWith('de');
  }
}
