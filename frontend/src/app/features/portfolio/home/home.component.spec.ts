import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';

import { HomeComponent } from './home.component';
import { ProjectService } from '@core/services/project.service';
import { ArticleService } from '@core/services/article.service';
import { Project } from '@shared/models/project.model';
import { Article } from '@shared/models/article.model';

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

  const mockArticle: Article = {
    id: 1,
    title: 'Mon article',
    slug: 'mon-article',
    summary: 'Résumé',
    content: 'Contenu',
    contentType: 'MARKDOWN',
    coverImageUrl: undefined,
    tags: ['kubernetes'],
    status: 'PUBLISHED',
    publishedAt: '2026-08-09T10:00:00',
    authorName: 'Amine Charrad',
    createdAt: '',
    updatedAt: '',
  };

  const mockProjectService = {
    getFeaturedProjects: jest.fn(),
    getProjects: jest.fn(),
  };

  const mockArticleService = {
    getArticles: jest.fn(),
  };

  beforeEach(async () => {
    mockArticleService.getArticles.mockReturnValue(
      of({
        content: [],
        page: 0,
        size: 3,
        totalElements: 0,
        totalPages: 0,
        first: true,
        last: true,
      })
    );

    await TestBed.configureTestingModule({
      imports: [HomeComponent, RouterTestingModule, HttpClientTestingModule],
      providers: [
        { provide: ProjectService, useValue: mockProjectService },
        { provide: ArticleService, useValue: mockArticleService },
      ],
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
    expect(component['error']()).toBeTruthy();
    expect(component['isLoading']()).toBe(false);
  });

  it('should retry load on retryLoad()', () => {
    mockProjectService.getFeaturedProjects.mockReturnValue(of([]));
    fixture.detectChanges();
    component['retryLoad']();
    expect(mockProjectService.getFeaturedProjects).toHaveBeenCalledTimes(2);
  });

  it('should load the latest published articles on init', () => {
    mockProjectService.getFeaturedProjects.mockReturnValue(of([]));
    mockArticleService.getArticles.mockReturnValue(
      of({
        content: [mockArticle],
        page: 0,
        size: 3,
        totalElements: 1,
        totalPages: 1,
        first: true,
        last: true,
      })
    );

    fixture.detectChanges();

    expect(mockArticleService.getArticles).toHaveBeenCalledWith(0, 3);
    expect(component['latestArticles']()).toHaveLength(1);
  });

  it('should set isLoadingArticles to false when the articles request fails', () => {
    mockProjectService.getFeaturedProjects.mockReturnValue(of([]));
    mockArticleService.getArticles.mockReturnValue(throwError(() => new Error('network')));

    fixture.detectChanges();

    expect(component['isLoadingArticles']()).toBe(false);
    expect(component['latestArticles']()).toHaveLength(0);
  });
});
