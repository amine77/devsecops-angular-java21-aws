import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { signal } from '@angular/core';

import { DashboardComponent } from './dashboard.component';
import { ProjectService } from '@core/services/project.service';
import { ArticleService } from '@core/services/article.service';
import { AuthService } from '@core/services/auth.service';
import { Project } from '@shared/models/project.model';
import { Article } from '@shared/models/article.model';

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;

  const mockProject: Project = {
    id: 1,
    title: 'Test',
    description: 'Desc',
    summary: undefined,
    githubUrl: undefined,
    demoUrl: undefined,
    imageUrl: undefined,
    featured: false,
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
    status: 'DRAFT',
    publishedAt: undefined,
    authorName: 'Amine Charrad',
    createdAt: '',
    updatedAt: '',
  };

  const mockProjectService = {
    getProjects: jest.fn(),
    deleteProject: jest.fn(),
  };

  const mockArticleService = {
    getArticlesForAdmin: jest.fn(),
    deleteArticle: jest.fn(),
  };

  const mockAuthService = {
    displayName: signal('Admin'),
    isAuthenticated: jest.fn().mockReturnValue(true),
    isAdmin: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    mockProjectService.getProjects.mockReturnValue(
      of({
        content: [mockProject],
        page: 0,
        size: 50,
        totalElements: 1,
        totalPages: 1,
        first: true,
        last: true,
      })
    );
    mockArticleService.getArticlesForAdmin.mockReturnValue(
      of({
        content: [mockArticle],
        page: 0,
        size: 50,
        totalElements: 1,
        totalPages: 1,
        first: true,
        last: true,
      })
    );

    await TestBed.configureTestingModule({
      imports: [
        DashboardComponent,
        RouterTestingModule,
        HttpClientTestingModule,
        MatDialogModule,
        MatSnackBarModule,
        NoopAnimationsModule,
      ],
      providers: [
        { provide: ProjectService, useValue: mockProjectService },
        { provide: ArticleService, useValue: mockArticleService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => jest.clearAllMocks());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load projects on init', () => {
    expect(mockProjectService.getProjects).toHaveBeenCalledWith(0, 50);
    expect(component['isLoading']()).toBe(false);
    expect(component['projects']()).toHaveLength(1);
  });

  it('should load articles on init', () => {
    expect(mockArticleService.getArticlesForAdmin).toHaveBeenCalledWith(0, 50);
    expect(component['isLoadingArticles']()).toBe(false);
    expect(component['articles']()).toHaveLength(1);
  });

  it('should open confirm dialog on confirmDelete', () => {
    const openSpy = jest.spyOn(component['dialog'], 'open').mockReturnValue({
      afterClosed: () => of(false),
    } as never);

    component.confirmDelete(mockProject);

    expect(openSpy).toHaveBeenCalled();
  });

  it('should delete project when dialog confirmed', () => {
    mockProjectService.deleteProject.mockReturnValue(of(void 0));
    jest.spyOn(component['dialog'], 'open').mockReturnValue({
      afterClosed: () => of(true),
    } as never);

    component.confirmDelete(mockProject);

    expect(mockProjectService.deleteProject).toHaveBeenCalledWith(1);
    expect(component['projects']()).toHaveLength(0);
  });

  it('should open confirm dialog on confirmDeleteArticle', () => {
    const openSpy = jest.spyOn(component['dialog'], 'open').mockReturnValue({
      afterClosed: () => of(false),
    } as never);

    component.confirmDeleteArticle(mockArticle);

    expect(openSpy).toHaveBeenCalled();
  });

  it('should hard-delete the article when dialog confirmed', () => {
    mockArticleService.deleteArticle.mockReturnValue(of(void 0));
    jest.spyOn(component['dialog'], 'open').mockReturnValue({
      afterClosed: () => of(true),
    } as never);

    component.confirmDeleteArticle(mockArticle);

    expect(mockArticleService.deleteArticle).toHaveBeenCalledWith(1);
    expect(component['articles']()).toHaveLength(0);
  });
});
