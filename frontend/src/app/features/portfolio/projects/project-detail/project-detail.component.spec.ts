import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';

import { ProjectDetailComponent } from './project-detail.component';
import { ProjectService } from '@core/services/project.service';
import { Project } from '@shared/models/project.model';

describe('ProjectDetailComponent', () => {
  let fixture: ComponentFixture<ProjectDetailComponent>;
  let component: ProjectDetailComponent;

  const mockProject: Project = {
    id: 1,
    title: 'Portfolio DevSecOps',
    description: 'Desc',
    summary: 'Résumé',
    githubUrl: 'https://github.com/amine77/devsecops-angular-java21-aws',
    demoUrl: 'https://charrad-devsecops.duckdns.org',
    imageUrl: 'https://example.com/image.png',
    featured: true,
    sortOrder: 1,
    status: 'ACTIVE',
    skills: [{ id: 1, name: 'Angular', category: 'FRONTEND', iconUrl: null, level: 4, sortOrder: 1 }],
    createdAt: '',
    updatedAt: '',
  };

  const mockProjectService = {
    getProjectById: jest.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectDetailComponent, RouterTestingModule, HttpClientTestingModule],
      providers: [{ provide: ProjectService, useValue: mockProjectService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectDetailComponent);
    component = fixture.componentInstance;
    component.id = '1';
  });

  afterEach(() => jest.clearAllMocks());

  it('should create', () => {
    mockProjectService.getProjectById.mockReturnValue(of(mockProject));
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should load project by id on init', () => {
    mockProjectService.getProjectById.mockReturnValue(of(mockProject));
    fixture.detectChanges();
    expect(mockProjectService.getProjectById).toHaveBeenCalledWith(1);
    expect(component['project']()?.title).toBe('Portfolio DevSecOps');
    expect(component['isLoading']()).toBe(false);
  });

  it('should set error on load failure', () => {
    mockProjectService.getProjectById.mockReturnValue(throwError(() => new Error('err')));
    fixture.detectChanges();
    expect(component['error']()).toBe('projects.detail.error');
    expect(component['isLoading']()).toBe(false);
  });
});
