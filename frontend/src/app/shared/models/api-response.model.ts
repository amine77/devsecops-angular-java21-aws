/**
 * Wrapper standard de toutes les réponses API — miroir de ApiResponse<T> Java.
 *
 * Raison d'un type générique :
 * - data peut être Project, Skill[], PageResponse<Project>, etc.
 * - Le frontend sait toujours à quoi s'attendre (success, data, message)
 */
export interface ApiResponse<T> {
  readonly success: boolean;
  readonly message?: string;
  readonly data?: T;
  readonly timestamp: string;
}

/**
 * Réponse paginée — miroir de PageResponse<T> Java.
 */
export interface PageResponse<T> {
  readonly content: T[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
  readonly first: boolean;
  readonly last: boolean;
}

/**
 * Réponse d'erreur standardisée.
 */
export interface ErrorResponse {
  readonly timestamp: string;
  readonly status: number;
  readonly error: string;
  readonly message: string;
  readonly path: string;
  readonly validationErrors?: Record<string, string>;
}
