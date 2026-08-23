import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ApiResponse } from '@shared/models/api-response.model';
import { Experience, ExperienceFormData } from '@shared/models/experience.model';
import { environment } from '@environments/environment';

@Injectable({ providedIn: 'root' })
export class ExperienceService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/experiences`;

  getExperiences(): Observable<Experience[]> {
    return this.http
      .get<ApiResponse<Experience[]>>(this.baseUrl)
      .pipe(map((r) => r.data!));
  }

  getExperienceById(id: number): Observable<Experience> {
    return this.http
      .get<ApiResponse<Experience>>(`${this.baseUrl}/${id}`)
      .pipe(map((r) => r.data!));
  }

  createExperience(data: ExperienceFormData): Observable<Experience> {
    return this.http.post<ApiResponse<Experience>>(this.baseUrl, data).pipe(map((r) => r.data!));
  }

  updateExperience(id: number, data: ExperienceFormData): Observable<Experience> {
    return this.http
      .put<ApiResponse<Experience>>(`${this.baseUrl}/${id}`, data)
      .pipe(map((r) => r.data!));
  }

  deleteExperience(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
