import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { BlogDetailComponent } from './blog-detail.component';
import { ArticleService } from '@core/services/article.service';
import { Article } from '@shared/models/article.model';

describe('BlogDetailComponent', () => {
  let fixture: ComponentFixture<BlogDetailComponent>;
  let component: BlogDetailComponent;

  const mockArticle: Article = {
    id: 1,
    title: 'Mon article',
    slug: 'mon-article',
    summary: 'Résumé',
    content: '# Titre\n\nContenu **gras** et `code`.',
    coverImageUrl: undefined,
    tags: ['kubernetes'],
    status: 'PUBLISHED',
    publishedAt: '2026-08-09T10:00:00',
    authorName: 'Amine Charrad',
    createdAt: '',
    updatedAt: '',
  };

  const mockArticleService = {
    getArticleBySlug: jest.fn(),
  };

  beforeEach(async () => {
    mockArticleService.getArticleBySlug.mockReturnValue(of(mockArticle));

    await TestBed.configureTestingModule({
      imports: [BlogDetailComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [{ provide: ArticleService, useValue: mockArticleService }],
    }).compileComponents();

    fixture = TestBed.createComponent(BlogDetailComponent);
    component = fixture.componentInstance;
    component.slug = 'mon-article';
  });

  afterEach(() => jest.clearAllMocks());

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should load the article and render sanitized HTML from Markdown', () => {
    fixture.detectChanges();

    expect(mockArticleService.getArticleBySlug).toHaveBeenCalledWith('mon-article');
    expect(component['article']()).toEqual(mockArticle);
    expect(component['renderedContent']()).toContain('<h1');
    expect(component['renderedContent']()).toContain('<strong>gras</strong>');
    expect(component['isLoading']()).toBe(false);
  });

  it('should strip script tags from rendered content (XSS)', () => {
    mockArticleService.getArticleBySlug.mockReturnValue(
      of({ ...mockArticle, content: '<script>alert(1)</script>Texte sûr' })
    );

    fixture.detectChanges();

    expect(component['renderedContent']()).not.toContain('<script>');
    expect(component['renderedContent']()).toContain('Texte sûr');
  });

  it('should set a translated error message when the article is not found', () => {
    mockArticleService.getArticleBySlug.mockReturnValue(throwError(() => new Error('404')));

    fixture.detectChanges();

    expect(component['error']()).toBeTruthy();
    expect(component['isLoading']()).toBe(false);
  });
});
