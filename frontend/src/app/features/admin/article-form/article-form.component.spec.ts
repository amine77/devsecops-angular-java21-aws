import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ArticleFormComponent } from './article-form.component';
import { ArticleService } from '@core/services/article.service';
import { Article } from '@shared/models/article.model';

describe('ArticleFormComponent', () => {
  let fixture: ComponentFixture<ArticleFormComponent>;
  let component: ArticleFormComponent;

  const mockArticle: Article = {
    id: 1,
    title: 'Mon article',
    slug: 'mon-article',
    summary: 'Résumé',
    content: 'Contenu Markdown',
    coverImageUrl: undefined,
    tags: ['kubernetes'],
    status: 'DRAFT',
    publishedAt: undefined,
    authorName: 'Amine Charrad',
    createdAt: '',
    updatedAt: '',
  };

  const mockArticleService = {
    getArticleByIdForAdmin: jest.fn(),
    createArticle: jest.fn(),
    updateArticle: jest.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ArticleFormComponent,
        RouterTestingModule,
        HttpClientTestingModule,
        MatSnackBarModule,
        NoopAnimationsModule,
      ],
      providers: [{ provide: ArticleService, useValue: mockArticleService }],
    }).compileComponents();

    jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(ArticleFormComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => jest.clearAllMocks());

  it('should create in "new article" mode when no id is provided', () => {
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(component['isEditMode']).toBe(false);
  });

  it('should load the article and patch the form when an id is provided', () => {
    mockArticleService.getArticleByIdForAdmin.mockReturnValue(of(mockArticle));
    component.id = '1';

    fixture.detectChanges();

    expect(mockArticleService.getArticleByIdForAdmin).toHaveBeenCalledWith(1);
    expect(component['form'].get('title')?.value).toBe('Mon article');
    expect(component['tags']()).toEqual(['kubernetes']);
  });

  it('should not submit an invalid form', () => {
    fixture.detectChanges();

    component.onSubmit();

    expect(mockArticleService.createArticle).not.toHaveBeenCalled();
  });

  it('should create the article and navigate to /admin on success', () => {
    fixture.detectChanges();
    mockArticleService.createArticle.mockReturnValue(of(mockArticle));

    component['form'].patchValue({ title: 'Nouveau titre', content: 'Contenu suffisant' });
    component.onSubmit();

    expect(mockArticleService.createArticle).toHaveBeenCalled();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/admin']);
  });

  it('should show an error message when the save fails', () => {
    fixture.detectChanges();
    mockArticleService.createArticle.mockReturnValue(
      throwError(() => ({ status: 0 }))
    );

    component['form'].patchValue({ title: 'Nouveau titre', content: 'Contenu suffisant' });
    component.onSubmit();

    expect(component['errorMessage']()).toBeTruthy();
  });

  it('should add a tag via addTag() and avoid duplicates', () => {
    fixture.detectChanges();

    component.addTag({ value: 'kubernetes', chipInput: { clear: () => {} } } as never);
    component.addTag({ value: 'kubernetes', chipInput: { clear: () => {} } } as never);
    component.addTag({ value: 'docker', chipInput: { clear: () => {} } } as never);

    expect(component['tags']()).toEqual(['kubernetes', 'docker']);
  });

  it('should remove a tag via removeTag()', () => {
    fixture.detectChanges();
    component.addTag({ value: 'kubernetes', chipInput: { clear: () => {} } } as never);

    component.removeTag('kubernetes');

    expect(component['tags']()).toEqual([]);
  });
});
