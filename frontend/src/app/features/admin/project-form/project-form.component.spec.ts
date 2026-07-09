import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { ProjectFormComponent } from './project-form.component';
import { ProjectService } from '@core/services/project.service';
import { SkillService } from '@core/services/skill.service';

describe('ProjectFormComponent', () => {
  let fixture: ComponentFixture<ProjectFormComponent>;
  let component: ProjectFormComponent;

  const mockProject = {
    id: 1,
    title: 'Test',
    description: 'Description longue',
    summary: 'Résumé',
    githubUrl: 'https://github.com/test',
    demoUrl: null,
    imageUrl: null,
    featured: true,
    sortOrder: 1,
    status: 'ACTIVE',
    skills: [{ id: 1, name: 'Java', category: 'BACKEND', iconUrl: null, level: 1, sortOrder: 1 }],
    createdAt: '',
    updatedAt: '',
  };

  const mockSkill = {
    id: 1,
    name: 'Java',
    category: 'BACKEND',
    iconUrl: null,
    level: 1,
    sortOrder: 1,
  };

  const mockProjectService = {
    getProjectById: jest.fn(),
    createProject: jest.fn(),
    updateProject: jest.fn(),
  };

  const mockSkillService = {
    getAllSkills: jest.fn().mockReturnValue(of([mockSkill])),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ProjectFormComponent,
        RouterTestingModule,
        HttpClientTestingModule,
        MatSnackBarModule,
        NoopAnimationsModule,
      ],
      providers: [
        { provide: ProjectService, useValue: mockProjectService },
        { provide: SkillService, useValue: mockSkillService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectFormComponent);
    component = fixture.componentInstance;

    // Mock par défaut de router.navigate : en zoneless, une navigation vers une
    // route inexistante (NG04002) devient une promesse rejetée NON capturée
    // (zone.js l'avalait) et fait crasher le worker Jest.
    jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => jest.clearAllMocks());

  it('should create in create mode', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(component['isEditMode']).toBe(false);
  });

  it('should load skills on init', () => {
    fixture.detectChanges();
    expect(mockSkillService.getAllSkills).toHaveBeenCalled();
    expect(component['allSkills']()).toHaveLength(1);
  });

  it('should load project in edit mode', () => {
    mockProjectService.getProjectById.mockReturnValue(of(mockProject));
    component.id = '1';
    fixture.detectChanges();
    expect(mockProjectService.getProjectById).toHaveBeenCalledWith(1);
    expect(component.form.get('title')?.value).toBe('Test');
    expect(component['isEditMode']).toBe(true);
  });

  it('should detect selected skill', () => {
    mockProjectService.getProjectById.mockReturnValue(of(mockProject));
    component.id = '1';
    fixture.detectChanges();
    expect(component['isSkillSelected'](1)).toBe(true);
    expect(component['isSkillSelected'](99)).toBe(false);
  });

  it('should toggle skill selection', () => {
    fixture.detectChanges();
    component['onSkillChange'](1, true);
    expect(component['isSkillSelected'](1)).toBe(true);
    component['onSkillChange'](1, false);
    expect(component['isSkillSelected'](1)).toBe(false);
  });

  it('should not accumulate duplicate skillIds when selectionChange fires repeatedly for an already selected skill', () => {
    // Reproduit le bug de prod : Angular Material peut redéclencher (selectionChange)
    // pour un chip déjà sélectionné (ex. resynchronisation du binding [selected]),
    // ce qui faisait grossir selectedSkillIds avec des doublons -> 404 backend.
    fixture.detectChanges();
    component['onSkillChange'](1, true);
    component['onSkillChange'](1, true);
    component['onSkillChange'](1, true);
    expect(component['selectedSkillIds']()).toEqual([1]);
  });

  it('should mark form as touched on invalid submit', () => {
    fixture.detectChanges();
    component.onSubmit();
    expect(component.form.touched).toBe(true);
  });

  it('should create project on valid submit', () => {
    mockProjectService.createProject.mockReturnValue(of(mockProject));
    fixture.detectChanges();
    component.form.patchValue({
      title: 'Nouveau Projet',
      description: 'Description de 10 chars min',
    });
    component.onSubmit();
    expect(mockProjectService.createProject).toHaveBeenCalled();
  });

  it('should set errorMessage on submit failure', () => {
    mockProjectService.createProject.mockReturnValue(throwError(() => new Error('err')));
    fixture.detectChanges();
    component.form.patchValue({
      title: 'Nouveau Projet',
      description: 'Description de 10 chars min',
    });
    component.onSubmit();
    expect(component['errorMessage']()).toBeTruthy(); // translated text depends on runtime lang
  });

  it('should surface the backend validation message instead of a generic error on 400', () => {
    // Bug de prod : une URL GitHub sans schéma (ex. "github.com/x") passe la validation
    // frontend (aucun validator avant ce fix) mais échoue le @URL backend en 400 —
    // l'ancien handler affichait toujours le même message générique.
    mockProjectService.createProject.mockReturnValue(
      throwError(() => ({
        status: 400,
        error: {
          message: 'Erreur de validation des données',
          validationErrors: { githubUrl: "L'URL GitHub doit être une URL valide" },
        },
      }))
    );
    fixture.detectChanges();
    component.form.patchValue({
      title: 'Nouveau Projet',
      description: 'Description de 10 chars min',
    });
    component.onSubmit();
    expect(component['errorMessage']()).toBe("L'URL GitHub doit être une URL valide");
  });

  it('should reject a githubUrl without http(s) scheme', () => {
    fixture.detectChanges();
    component.form.patchValue({ githubUrl: 'github.com/amine77/foo' });
    expect(component.form.get('githubUrl')?.valid).toBe(false);

    component.form.patchValue({ githubUrl: 'https://github.com/amine77/foo' });
    expect(component.form.get('githubUrl')?.valid).toBe(true);
  });

  it('isInvalid returns false for valid untouched field', () => {
    fixture.detectChanges();
    expect(component['isInvalid']('title')).toBe(false);
  });
});
