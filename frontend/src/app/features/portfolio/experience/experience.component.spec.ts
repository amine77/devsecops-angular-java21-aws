import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';

import { ExperienceComponent } from './experience.component';
import { ExperienceService } from '@core/services/experience.service';
import { Experience } from '@shared/models/experience.model';

describe('ExperienceComponent', () => {
  let fixture: ComponentFixture<ExperienceComponent>;
  let component: ExperienceComponent;

  const mockExperiences: Experience[] = [
    {
      id: 1,
      entreprise: 'Allianz France',
      poste: 'Tech Lead',
      contexte: "Groupe d'assurance international",
      dateDebut: '2020-06-01',
      dateFin: undefined,
      current: true,
      description: 'Lead hands-on',
      realisations: ['Réalisation 1'],
      stack: ['Java 21'],
      ordreAffichage: 1,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 2,
      entreprise: 'Société Générale Securities Services',
      poste: 'Ingénieur Java',
      contexte: "Banque de financement et d'investissement",
      dateDebut: '2016-01-01',
      dateFin: '2020-05-31',
      current: false,
      description: 'Développement backend',
      realisations: ['Réalisation A'],
      stack: ['Java 8'],
      ordreAffichage: 2,
      createdAt: '',
      updatedAt: '',
    },
  ];

  const mockExperienceService = {
    getExperiences: jest.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExperienceComponent, RouterTestingModule, HttpClientTestingModule],
      providers: [{ provide: ExperienceService, useValue: mockExperienceService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ExperienceComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => jest.clearAllMocks());

  it('should create', () => {
    mockExperienceService.getExperiences.mockReturnValue(of([]));
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should load and display the experiences', () => {
    mockExperienceService.getExperiences.mockReturnValue(of(mockExperiences));
    fixture.detectChanges();

    expect(component['isLoading']()).toBe(false);
    expect(component['experiences']()).toHaveLength(2);
  });

  it('should set a translated error message when the request fails', () => {
    mockExperienceService.getExperiences.mockReturnValue(throwError(() => new Error('err')));
    fixture.detectChanges();

    expect(component['error']()).toBeTruthy();
    expect(component['isLoading']()).toBe(false);
  });

  it('should reload the experiences when loadExperiences() is called again', () => {
    mockExperienceService.getExperiences.mockReturnValue(of(mockExperiences));
    fixture.detectChanges();

    component['loadExperiences']();

    expect(mockExperienceService.getExperiences).toHaveBeenCalledTimes(2);
  });

  it('should inject a JSON-LD script tag describing the profile', () => {
    mockExperienceService.getExperiences.mockReturnValue(of(mockExperiences));
    fixture.detectChanges();

    const script = document.getElementById('experience-jsonld');
    expect(script).toBeTruthy();
    const jsonLd = JSON.parse(script!.textContent ?? '{}');
    expect(jsonLd['@type']).toBe('Person');
    expect(jsonLd.worksFor.name).toBe('Allianz France');
    expect(jsonLd.alumniOf).toEqual([
      { '@type': 'Organization', name: 'Société Générale Securities Services' },
    ]);
  });

  it('should remove the JSON-LD script tag on destroy', () => {
    mockExperienceService.getExperiences.mockReturnValue(of(mockExperiences));
    fixture.detectChanges();

    fixture.destroy();

    expect(document.getElementById('experience-jsonld')).toBeFalsy();
  });
});
