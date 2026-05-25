import { Injectable } from '@angular/core';

/**
 * Service d'abstraction du localStorage.
 *
 * Raisons d'abstraire localStorage :
 * - Testabilité : on peut mocker ce service dans les tests unitaires
 *   (localStorage n'existe pas dans Jest/jsdom sans configuration)
 * - Centralisation : un seul endroit pour les clés de stockage
 * - Type-safety : getItem<T>() retourne le bon type
 * - SSR-safe : si on ajoute SSR plus tard, on remplace ici
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private static readonly TOKEN_KEY = 'portfolio_jwt_token';
  private static readonly USER_KEY = 'portfolio_user';

  setToken(token: string): void {
    localStorage.setItem(StorageService.TOKEN_KEY, token);
  }

  getToken(): string | null {
    return localStorage.getItem(StorageService.TOKEN_KEY);
  }

  removeToken(): void {
    localStorage.removeItem(StorageService.TOKEN_KEY);
  }

  setItem<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  getItem<T>(key: string): T | null {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  removeItem(key: string): void {
    localStorage.removeItem(key);
  }

  clear(): void {
    localStorage.removeItem(StorageService.TOKEN_KEY);
    localStorage.removeItem(StorageService.USER_KEY);
  }

  get userKey(): string {
    return StorageService.USER_KEY;
  }
}
