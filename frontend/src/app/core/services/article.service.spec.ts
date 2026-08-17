import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { ArticleService } from './article.service';
import { Article, ArticleFormData } from '@shared/models/article.model';

describe('ArticleService', () => {
  let service: ArticleService;
  let httpMock: HttpTestingController;

  const mockArticle: Article = {
    id: 1,
    title: 'Mon article',
    slug: 'mon-article',
    summary: 'Résumé',
    content: 'Contenu **Markdown**',
    contentType: 'MARKDOWN',
    coverImageUrl: undefined,
    tags: ['kubernetes'],
    status: 'PUBLISHED',
    publishedAt: '2026-08-09T10:00:00',
    authorName: 'Amine Charrad',
    createdAt: '',
    updatedAt: '',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(ArticleService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getArticles() should send GET with pagination params', () => {
    service.getArticles(0, 9).subscribe((page) => {
      expect(page.content).toHaveLength(1);
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/articles') && r.params.has('page'));
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: {
        content: [mockArticle],
        page: 0,
        size: 9,
        totalElements: 1,
        totalPages: 1,
        first: true,
        last: true,
      },
    });
  });

  it('getArticles() should include the tag param when provided', () => {
    service.getArticles(0, 9, 'kubernetes').subscribe();

    const req = httpMock.expectOne((r) => r.params.get('tag') === 'kubernetes');
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: {
        content: [],
        page: 0,
        size: 9,
        totalElements: 0,
        totalPages: 0,
        first: true,
        last: true,
      },
    });
  });

  it('getArticleBySlug() should GET /articles/:slug', () => {
    service.getArticleBySlug('mon-article').subscribe((article) => {
      expect(article.slug).toBe('mon-article');
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/articles/mon-article'));
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: mockArticle });
  });

  it('getArticlesForAdmin() should GET /articles/admin', () => {
    service.getArticlesForAdmin(0, 50).subscribe((page) => {
      expect(page.content).toHaveLength(1);
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/articles/admin'));
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: {
        content: [mockArticle],
        page: 0,
        size: 50,
        totalElements: 1,
        totalPages: 1,
        first: true,
        last: true,
      },
    });
  });

  it('getArticleByIdForAdmin() should GET /articles/admin/:id', () => {
    service.getArticleByIdForAdmin(1).subscribe((article) => {
      expect(article.id).toBe(1);
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/articles/admin/1'));
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: mockArticle });
  });

  it('createArticle() should POST the form data', () => {
    const formData: ArticleFormData = {
      title: 'Nouveau',
      content: 'Contenu',
      contentType: 'MARKDOWN',
      tags: [],
      status: 'DRAFT',
    };

    service.createArticle(formData).subscribe((article) => {
      expect(article.id).toBe(1);
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/articles') && r.method === 'POST');
    expect(req.request.body).toEqual(formData);
    req.flush({ success: true, data: mockArticle });
  });

  it('updateArticle() should PUT the form data', () => {
    const formData: ArticleFormData = {
      title: 'Modifié',
      content: 'Contenu modifié',
      contentType: 'MARKDOWN',
      tags: ['kubernetes'],
      status: 'PUBLISHED',
    };

    service.updateArticle(1, formData).subscribe((article) => {
      expect(article.id).toBe(1);
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/articles/1') && r.method === 'PUT');
    expect(req.request.body).toEqual(formData);
    req.flush({ success: true, data: mockArticle });
  });

  it('deleteArticle() should DELETE by id', () => {
    service.deleteArticle(1).subscribe();

    const req = httpMock.expectOne((r) => r.url.endsWith('/articles/1') && r.method === 'DELETE');
    req.flush(null);
  });
});
