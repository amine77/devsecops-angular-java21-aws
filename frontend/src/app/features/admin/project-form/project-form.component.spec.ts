import { ComponentFixture, TestBed } from '@angular/core/testing';
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
    expect(component['errorMessage']()).toBe('Erreur lors de la sauvegarde.');
  });

  it('isInvalid returns false for valid untouched field', () => {
    fixture.detectChanges();
    expect(component['isInvalid']('title')).toBe(false);
  });
});
