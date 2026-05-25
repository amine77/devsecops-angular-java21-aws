import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ApiResponse, PageResponse } from '@shared/models/api-response.model';
import { Project, ProjectFormData } from '@shared/models/project.model';
import { environment } from '@environments/environment';

/**
 * Service HTTP pour les projets.
 *
 * Responsabilités :
 * - Appels HTTP vers l'API Spring Boot
 * - Typage fort des requêtes/réponses
 * - Extraction de la data depuis le wrapper ApiResponse<T>
 *
 * Raison de séparer Service HTTP et composant :
 * - Testabilité : on peut mocker le service dans les tests de composants
 * - Réutilisabilité : plusieurs composants utilisent le même service
 * - Séparation des responsabilités (SRP)
 *
 * map(r => r.data!) : extrait la data du wrapper ApiResponse.
 * Le ! indique qu'on sait que data est présent (après vérification success).
 */
@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/projects`;

  /**
   * Récupère les projets paginés.
   *
   * @param page numéro de page (0-based)
   * @param size éléments par page
   * @returns Observable<PageResponse<Project>>
   */
  getProjects(page = 0, size = 9): Observable<PageResponse<Project>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', 'sortOrder,asc');

    return this.http
      .get<ApiResponse<PageResponse<Project>>>(this.baseUrl, { params })
      .pipe(map((r) => r.data!));
  }

  /** Projets mis en avant (homepage). */
  getFeaturedProjects(): Observable<Project[]> {
    return this.http
      .get<ApiResponse<Project[]>>(`${this.baseUrl}/featured`)
      .pipe(map((r) => r.data!));
  }

  /** Détail d'un projet par ID. */
  getProjectById(id: number): Observable<Project> {
    return this.http
      .get<ApiResponse<Project>>(`${this.baseUrl}/${id}`)
      .pipe(map((r) => r.data!));
  }

  /** Crée un projet (ADMIN). */
  createProject(data: ProjectFormData): Observable<Project> {
    return this.http
      .post<ApiResponse<Project>>(this.baseUrl, data)
      .pipe(map((r) => r.data!));
  }

  /** Met à jour un projet (ADMIN). */
  updateProject(id: number, data: ProjectFormData): Observable<Project> {
    return this.http
      .put<ApiResponse<Project>>(`${this.baseUrl}/${id}`, data)
      .pipe(map((r) => r.data!));
  }

  /** Archive un projet (ADMIN). */
  deleteProject(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
