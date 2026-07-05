import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';

import { ProjectListComponent } from './project-list.component';
import { ProjectService } from '@core/services/project.service';
import { ScrollAnimationService } from '@core/animation/scroll-animation.service';
import { PageResponse } from '@shared/models/api-response.model';
import { Project } from '@shared/models/project.model';

describe('ProjectListComponent', () => {
  let fixture: ComponentFixture<ProjectListComponent>;
  let component: ProjectListComponent;

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

  const mockPage = (overrides: Partial<PageResponse<Project>> = {}): PageResponse<Project> => ({
    content: [mockProject],
    page: 0,
    size: 9,
    totalElements: 1,
    totalPages: 1,
    first: true,
    last: true,
    ...overrides,
  });

  const mockProjectService = {
    getProjects: jest.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectListComponent, RouterTestingModule, HttpClientTestingModule],
      providers: [{ provide: ProjectService, useValue: mockProjectService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectListComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => jest.clearAllMocks());

  it('should create', () => {
    mockProjectService.getProjects.mockReturnValue(of(mockPage()));
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should load projects on init', () => {
    mockProjectService.getProjects.mockReturnValue(of(mockPage()));
    fixture.detectChanges();
    expect(component['isLoading']()).toBe(false);
    expect(component['pageData']()?.content).toHaveLength(1);
  });

  it('should set error on load failure', () => {
    mockProjectService.getProjects.mockReturnValue(throwError(() => new Error('err')));
    fixture.detectChanges();
    expect(component['error']()).toBeTruthy();
    expect(component['isLoading']()).toBe(false);
  });

  it('should go to next page', () => {
    mockProjectService.getProjects.mockReturnValue(of(mockPage({ totalPages: 2, last: false })));
    fixture.detectChanges();
    component['nextPage']();
    expect(mockProjectService.getProjects).toHaveBeenCalledTimes(2);
  });

  it('should go to previous page', () => {
    mockProjectService.getProjects.mockReturnValue(
      of(mockPage({ page: 1, totalPages: 2, first: false }))
    );
    fixture.detectChanges();
    component['prevPage']();
    expect(mockProjectService.getProjects).toHaveBeenCalledTimes(2);
  });

  it('should retry loading on loadProjects()', () => {
    mockProjectService.getProjects.mockReturnValue(of(mockPage()));
    fixture.detectChanges();
    component['loadProjects']();
    expect(mockProjectService.getProjects).toHaveBeenCalledTimes(2);
  });

  it('should destroy without error', () => {
    mockProjectService.getProjects.mockReturnValue(of(mockPage()));
    fixture.detectChanges();
    expect(() => fixture.destroy()).not.toThrow();
  });

  it('should not animate the cards when there is no card to animate', () => {
    jest.useFakeTimers();
    mockProjectService.getProjects.mockReturnValue(of(mockPage({ content: [] })));
    fixture.detectChanges();
    expect(() => jest.advanceTimersByTime(0)).not.toThrow();
    jest.useRealTimers();
  });
});

describe('ProjectListComponent (reducedMotion)', () => {
  let fixture: ComponentFixture<ProjectListComponent>;

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
    getProjects: jest.fn().mockReturnValue(
      of({
        content: [mockProject],
        page: 0,
        size: 9,
        totalElements: 1,
        totalPages: 1,
        first: true,
        last: true,
      })
    ),
  };

  const mockScrollAnimationService = { reducedMotion: true };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectListComponent, RouterTestingModule, HttpClientTestingModule],
      providers: [
        { provide: ProjectService, useValue: mockProjectService },
        { provide: ScrollAnimationService, useValue: mockScrollAnimationService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectListComponent);
  });

  afterEach(() => jest.clearAllMocks());

  it('should skip the header and card animations when reducedMotion is true', () => {
    expect(() => fixture.detectChanges()).not.toThrow();
  });
});
