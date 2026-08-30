import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { LANGUAGES, LanguageService } from './language.service';

describe('LanguageService', () => {
  let service: LanguageService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(LanguageService);
    httpMock = TestBed.inject(HttpTestingController);
    // flush initial fr.json load
    const req = httpMock.expectOne('/assets/i18n/fr.json');
    req.flush({ 'nav.portfolio': 'Portfolio', 'skills.title': 'Compétences' });
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should default to French', () => {
    expect(service.current()).toBe('fr');
  });

  it('should translate a key', () => {
    expect(service.translate('nav.portfolio')).toBe('Portfolio');
  });

  it('should return key if translation missing', () => {
    expect(service.translate('unknown.key')).toBe('unknown.key');
  });

  it('should switch language and load new translations', () => {
    service.setLanguage('en');
    expect(service.current()).toBe('en');
    const req = httpMock.expectOne('/assets/i18n/en.json');
    req.flush({ 'nav.portfolio': 'Portfolio', 'skills.title': 'Skills' });
    expect(service.translate('skills.title')).toBe('Skills');
  });

  it('should persist language in localStorage', () => {
    service.setLanguage('en');
    expect(localStorage.getItem('lang')).toBe('en');
    const req = httpMock.expectOne('/assets/i18n/en.json');
    req.flush({});
  });

  it('should reset translations to an empty object on http error', () => {
    service.setLanguage('en');
    const req = httpMock.expectOne('/assets/i18n/en.json');
    req.error(new ProgressEvent('error'));
    expect(service.translate('nav.portfolio')).toBe('nav.portfolio');
  });

  it('should have removed German from the selectable languages', () => {
    expect(LANGUAGES.map((l) => l.code)).toEqual(['fr', 'en']);
  });

  it('should fall back to English for a stale "de" language saved before German was removed', () => {
    localStorage.setItem('lang', 'de');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });

    const freshService = TestBed.inject(LanguageService);
    const freshHttpMock = TestBed.inject(HttpTestingController);

    expect(freshService.current()).toBe('en');
    freshHttpMock.expectOne('/assets/i18n/en.json').flush({});
  });

  it('should fall back to English (not French) for a browser configured in German with no saved preference', () => {
    const navLangSpy = jest.spyOn(window.navigator, 'language', 'get').mockReturnValue('de-DE');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });

    const freshService = TestBed.inject(LanguageService);
    const freshHttpMock = TestBed.inject(HttpTestingController);

    expect(freshService.current()).toBe('en');
    freshHttpMock.expectOne('/assets/i18n/en.json').flush({});
    navLangSpy.mockRestore();
  });
});
