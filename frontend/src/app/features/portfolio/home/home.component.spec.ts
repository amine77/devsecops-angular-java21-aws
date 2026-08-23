import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';

import { HomeComponent } from './home.component';
import { ProjectService } from '@core/services/project.service';
import { ArticleService } from '@core/services/article.service';
import { ExperienceService } from '@core/services/experience.service';
import { Project } from '@shared/models/project.model';
import { Article } from '@shared/models/article.model';
import { Experience } from '@shared/models/experience.model';

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

  const mockExperience: Experience = {
    id: 1,
    entreprise: 'Allianz France',
    poste: 'Tech Lead',
    contexte: "Groupe d'assurance international",
    dateDebut: '2020-06-01',
    dateFin: undefined,
    current: true,
    description: 'Lead hands-on',
    realisations: ['Réalisation 1', 'Réalisation 2', 'Réalisation 3'],
    stack: ['Java 21'],
    ordreAffichage: 1,
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

  const mockExperienceService = {
    getExperiences: jest.fn(),
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
    mockExperienceService.getExperiences.mockReturnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [HomeComponent, RouterTestingModule, HttpClientTestingModule],
      providers: [
        { provide: ProjectService, useValue: mockProjectService },
        { provide: ArticleService, useValue: mockArticleService },
        { provide: ExperienceService, useValue: mockExperienceService },
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

  it('should load the experience preview capped at 2 items on init', () => {
    mockProjectService.getFeaturedProjects.mockReturnValue(of([]));
    mockExperienceService.getExperiences.mockReturnValue(
      of([mockExperience, mockExperience, mockExperience])
    );

    fixture.detectChanges();

    expect(mockExperienceService.getExperiences).toHaveBeenCalled();
    expect(component['previewExperiences']()).toHaveLength(2);
    expect(component['isLoadingExperience']()).toBe(false);
  });

  it('should set experienceError when the experience preview request fails', () => {
    mockProjectService.getFeaturedProjects.mockReturnValue(of([]));
    mockExperienceService.getExperiences.mockReturnValue(throwError(() => new Error('network')));

    fixture.detectChanges();

    expect(component['experienceError']()).toBeTruthy();
    expect(component['isLoadingExperience']()).toBe(false);
  });

  it('should retry the experience preview load on retryExperienceLoad()', () => {
    mockProjectService.getFeaturedProjects.mockReturnValue(of([]));
    fixture.detectChanges();
    component['retryExperienceLoad']();
    expect(mockExperienceService.getExperiences).toHaveBeenCalledTimes(2);
  });
});
