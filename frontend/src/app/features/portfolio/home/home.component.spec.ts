import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';

import { HomeComponent } from './home.component';
import { ProjectService } from '@core/services/project.service';
import { Project } from '@shared/models/project.model';

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;
  let component: HomeComponent;

  const mockProject: Project = {
    id: 1,
    title: 'Portfolio DevSecOps',
    description: 'Desc',
    summary: 'Résumé',
    githubUrl: null,
    demoUrl: null,
    imageUrl: null,
    featured: true,
    sortOrder: 1,
    status: 'ACTIVE',
    skills: [],
    createdAt: '',
    updatedAt: '',
  };

  const mockProjectService = {
    getFeaturedProjects: jest.fn(),
    getProjects: jest.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent, RouterTestingModule, HttpClientTestingModule],
      providers: [{ provide: ProjectService, useValue: mockProjectService }],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => jest.clearAllMocks());

  it('should create', () => {
    mockProjectService.getFeaturedProjects.mockReturnValue(of([]));
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should load featured projects on init', () => {
    mockProjectService.getFeaturedProjects.mockReturnValue(of([mockProject]));
    fixture.detectChanges();
    expect(component['featuredProjects']()).toHaveLength(1);
    expect(component['isLoading']()).toBe(false);
  });

  it('should set error on load failure', () => {
    mockProjectService.getFeaturedProjects.mockReturnValue(throwError(() => new Error('err')));
    fixture.detectChanges();
    expect(component['error']()).toBe('Impossible de charger les projets.');
    expect(component['isLoading']()).toBe(false);
  });

  it('should retry load on retryLoad()', () => {
    mockProjectService.getFeaturedProjects.mockReturnValue(of([]));
    fixture.detectChanges();
    component['retryLoad']();
    expect(mockProjectService.getFeaturedProjects).toHaveBeenCalledTimes(2);
  });
});
