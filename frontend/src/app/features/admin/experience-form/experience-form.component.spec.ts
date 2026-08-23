import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ExperienceFormComponent } from './experience-form.component';
import { ExperienceService } from '@core/services/experience.service';
import { Experience } from '@shared/models/experience.model';

describe('ExperienceFormComponent', () => {
  let fixture: ComponentFixture<ExperienceFormComponent>;
  let component: ExperienceFormComponent;

  const mockExperience: Experience = {
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
  };

  const mockExperienceService = {
    getExperienceById: jest.fn(),
    createExperience: jest.fn(),
    updateExperience: jest.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ExperienceFormComponent,
        RouterTestingModule,
        HttpClientTestingModule,
        NoopAnimationsModule,
      ],
      providers: [{ provide: ExperienceService, useValue: mockExperienceService }],
    }).compileComponents();

    jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(ExperienceFormComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => jest.clearAllMocks());

  it('should create in "new experience" mode when no id is provided', () => {
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(component['isEditMode']).toBe(false);
  });

  it('should load the experience and patch the form when an id is provided', () => {
    mockExperienceService.getExperienceById.mockReturnValue(of(mockExperience));
    component.id = '1';

    fixture.detectChanges();

    expect(mockExperienceService.getExperienceById).toHaveBeenCalledWith(1);
    expect(component['form'].get('entreprise')?.value).toBe('Allianz France');
    expect(component['realisations']()).toEqual(['Réalisation 1']);
    expect(component['stack']()).toEqual(['Java 21']);
  });

  it('should disable dateFin when the loaded experience is current', () => {
    mockExperienceService.getExperienceById.mockReturnValue(of(mockExperience));
    component.id = '1';

    fixture.detectChanges();

    expect(component['form'].get('dateFin')?.disabled).toBe(true);
  });

  it('should not submit an invalid form', () => {
    fixture.detectChanges();

    component.onSubmit();

    expect(mockExperienceService.createExperience).not.toHaveBeenCalled();
  });

  it('should create the experience and navigate to /admin on success', () => {
    fixture.detectChanges();
    mockExperienceService.createExperience.mockReturnValue(of(mockExperience));

    component['form'].patchValue({
      entreprise: 'Nouvelle entreprise',
      poste: 'Poste',
      dateDebut: '2020-01-01',
      description: 'Description suffisante',
    });
    component.onSubmit();

    expect(mockExperienceService.createExperience).toHaveBeenCalled();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/admin']);
  });

  it('should show an error message when the save fails', () => {
    fixture.detectChanges();
    mockExperienceService.createExperience.mockReturnValue(throwError(() => ({ status: 0 })));

    component['form'].patchValue({
      entreprise: 'Nouvelle entreprise',
      poste: 'Poste',
      dateDebut: '2020-01-01',
      description: 'Description suffisante',
    });
    component.onSubmit();

    expect(component['errorMessage']()).toBeTruthy();
  });

  it('should add a realisation via addRealisation() and a stack item via addStack()', () => {
    fixture.detectChanges();

    component.addRealisation({ value: 'Réalisation A', chipInput: { clear: () => {} } } as never);
    component.addStack({ value: 'Kafka', chipInput: { clear: () => {} } } as never);
    component.addStack({ value: 'Kafka', chipInput: { clear: () => {} } } as never);

    expect(component['realisations']()).toEqual(['Réalisation A']);
    expect(component['stack']()).toEqual(['Kafka']);
  });

  it('should remove a realisation via removeRealisation() and a stack item via removeStack()', () => {
    fixture.detectChanges();
    component.addRealisation({ value: 'Réalisation A', chipInput: { clear: () => {} } } as never);
    component.addStack({ value: 'Kafka', chipInput: { clear: () => {} } } as never);

    component.removeRealisation('Réalisation A');
    component.removeStack('Kafka');

    expect(component['realisations']()).toEqual([]);
    expect(component['stack']()).toEqual([]);
  });

  it('should clear and disable dateFin when onCurrentChange() is triggered with current checked', () => {
    fixture.detectChanges();
    component['form'].patchValue({ dateFin: '2024-01-01', current: true });

    component['onCurrentChange']();

    expect(component['form'].get('dateFin')?.value).toBe('');
    expect(component['form'].get('dateFin')?.disabled).toBe(true);
  });
});
