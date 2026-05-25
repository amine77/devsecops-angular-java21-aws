import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { ApiResponse } from '@shared/models/api-response.model';
import { AuthResponse, LoginCredentials, UserInfo } from '@shared/models/auth.model';
import { environment } from '@environments/environment';
import { StorageService } from './storage.service';

/**
 * Service d'authentification — gère l'état JWT et la session utilisateur.
 *
 * Utilise les Signals Angular 18 pour l'état réactif :
 *
 * signal()    → état mutable interne (_currentUser)
 * computed()  → dérivé calculé automatiquement (isAuthenticated, isAdmin)
 * asReadonly() → expose le signal en lecture seule (encapsulation)
 *
 * Avantage des Signals sur BehaviorSubject RxJS :
 * - Synchrones (pas de subscribe/unsubscribe)
 * - Intégrés au change detection Angular (Zone.js free possible)
 * - Plus simples à lire et tester
 * - Compatible avec OnPush change detection
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly storage = inject(StorageService);

  private readonly _currentUser = signal<UserInfo | null>(this.loadUserFromStorage());

  /** Signal lecture seule : l'utilisateur courant (null si non connecté). */
  readonly currentUser = this._currentUser.asReadonly();

  /** Computed : true si un utilisateur est connecté. */
  readonly isAuthenticated = computed(() => this._currentUser() !== null);

  /** Computed : true si l'utilisateur est ADMIN. */
  readonly isAdmin = computed(() => this._currentUser()?.role === 'ADMIN');

  /** Computed : nom d'affichage de l'utilisateur. */
  readonly displayName = computed(() => {
    const user = this._currentUser();
    return user ? `${user.firstName} ${user.lastName}` : null;
  });

  /**
   * Authentifie l'utilisateur, stocke le JWT et met à jour l'état.
   *
   * tap() : opérateur RxJS pour les effets de bord sans modifier le flux.
   * Raison : on ne modifie pas la réponse, on stocke juste le token.
   */
  login(credentials: LoginCredentials): Observable<ApiResponse<AuthResponse>> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${environment.apiUrl}/auth/login`, credentials)
      .pipe(
        tap((response) => {
          if (response.success && response.data) {
            this.storage.setToken(response.data.token);
            this.storage.setItem(this.storage.userKey, response.data.user);
            this._currentUser.set(response.data.user);
          }
        })
      );
  }

  /** Déconnexion : supprime le token et redirige. */
  logout(): void {
    this.storage.clear();
    this._currentUser.set(null);
    void this.router.navigate(['/auth/login']);
  }

  /** Retourne le token JWT stocké. */
  getToken(): string | null {
    return this.storage.getToken();
  }

  /** Charge l'utilisateur depuis le localStorage (persistance après refresh). */
  private loadUserFromStorage(): UserInfo | null {
    return this.storage.getItem<UserInfo>(this.storage.userKey);
  }
}
