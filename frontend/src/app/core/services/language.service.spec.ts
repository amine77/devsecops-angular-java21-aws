import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { LanguageService } from './language.service';

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
    service.setLanguage('de');
    expect(localStorage.getItem('lang')).toBe('de');
    const req = httpMock.expectOne('/assets/i18n/de.json');
    req.flush({});
  });
});
