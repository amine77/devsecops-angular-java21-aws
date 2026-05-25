import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ApiResponse } from '@shared/models/api-response.model';
import { Skill, SkillCategory } from '@shared/models/skill.model';
import { environment } from '@environments/environment';

@Injectable({ providedIn: 'root' })
export class SkillService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/skills`;

  /** Toutes les compétences (triées par catégorie). */
  getAllSkills(): Observable<Skill[]> {
    return this.http
      .get<ApiResponse<Skill[]>>(this.baseUrl)
      .pipe(map((r) => r.data!));
  }

  /** Compétences filtrées par catégorie. */
  getSkillsByCategory(category: SkillCategory): Observable<Skill[]> {
    const params = new HttpParams().set('category', category);
    return this.http
      .get<ApiResponse<Skill[]>>(this.baseUrl, { params })
      .pipe(map((r) => r.data!));
  }
}
