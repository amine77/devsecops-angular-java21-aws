import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type Language = 'fr' | 'en' | 'de';

export interface LanguageOption {
  code: Language;
  label: string;
  flag: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
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
    const saved = localStorage.getItem('lang') as Language;
    return LANGUAGES.some((l) => l.code === saved) ? saved : 'fr';
  }
}
