import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { BlogListComponent } from './blog-list.component';
import { ArticleService } from '@core/services/article.service';
import { Article } from '@shared/models/article.model';
import { PageResponse } from '@shared/models/api-response.model';

describe('BlogListComponent', () => {
  let fixture: ComponentFixture<BlogListComponent>;
  let component: BlogListComponent;

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

  const mockPage: PageResponse<Article> = {
    content: [mockArticle],
    page: 0,
    size: 9,
    totalElements: 1,
    totalPages: 1,
    first: true,
    last: true,
  };

  const mockArticleService = {
    getArticles: jest.fn(),
  };

  beforeEach(async () => {
    mockArticleService.getArticles.mockReturnValue(of(mockPage));

    await TestBed.configureTestingModule({
      imports: [BlogListComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [{ provide: ArticleService, useValue: mockArticleService }],
    }).compileComponents();

    fixture = TestBed.createComponent(BlogListComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => jest.clearAllMocks());

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should load articles on init', () => {
    fixture.detectChanges();

    expect(mockArticleService.getArticles).toHaveBeenCalledWith(0, 9, undefined);
    expect(component['pageData']()?.content).toHaveLength(1);
    expect(component['isLoading']()).toBe(false);
  });

  it('should set an error message when loading fails', () => {
    mockArticleService.getArticles.mockReturnValue(throwError(() => new Error('network')));

    fixture.detectChanges();

    expect(component['error']()).toBeTruthy();
    expect(component['isLoading']()).toBe(false);
  });

  it('should reload with the selected tag', () => {
    fixture.detectChanges();
    mockArticleService.getArticles.mockClear();

    component['filterByTag']('kubernetes');

    expect(mockArticleService.getArticles).toHaveBeenCalledWith(0, 9, 'kubernetes');
  });
});
