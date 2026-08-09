import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ApiResponse, PageResponse } from '@shared/models/api-response.model';
import { Article, ArticleFormData } from '@shared/models/article.model';
import { environment } from '@environments/environment';

@Injectable({ providedIn: 'root' })
export class ArticleService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/articles`;

  getArticles(page = 0, size = 9, tag?: string): Observable<PageResponse<Article>> {
    let params = new HttpParams().set('page', page.toString()).set('size', size.toString());
    if (tag) {
      params = params.set('tag', tag);
    }

    return this.http
      .get<ApiResponse<PageResponse<Article>>>(this.baseUrl, { params })
      .pipe(map((r) => r.data!));
  }

  getArticleBySlug(slug: string): Observable<Article> {
    return this.http
      .get<ApiResponse<Article>>(`${this.baseUrl}/${slug}`)
      .pipe(map((r) => r.data!));
  }

  getArticlesForAdmin(page = 0, size = 50): Observable<PageResponse<Article>> {
    const params = new HttpParams().set('page', page.toString()).set('size', size.toString());

    return this.http
      .get<ApiResponse<PageResponse<Article>>>(`${this.baseUrl}/admin`, { params })
      .pipe(map((r) => r.data!));
  }

  getArticleByIdForAdmin(id: number): Observable<Article> {
    return this.http
      .get<ApiResponse<Article>>(`${this.baseUrl}/admin/${id}`)
      .pipe(map((r) => r.data!));
  }

  createArticle(data: ArticleFormData): Observable<Article> {
    return this.http.post<ApiResponse<Article>>(this.baseUrl, data).pipe(map((r) => r.data!));
  }

  updateArticle(id: number, data: ArticleFormData): Observable<Article> {
    return this.http
      .put<ApiResponse<Article>>(`${this.baseUrl}/${id}`, data)
      .pipe(map((r) => r.data!));
  }

  deleteArticle(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
