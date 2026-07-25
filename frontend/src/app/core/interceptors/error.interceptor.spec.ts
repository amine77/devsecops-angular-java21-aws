import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { errorInterceptor } from './error.interceptor';
import { StorageService } from '@core/services/storage.service';

/**
 * Tests de l'intercepteur d'erreurs HTTP.
 *
 * Le point sensible est le 401 : selon qu'il vient de la requête de connexion
 * elle-même ou d'un appel authentifié, le comportement attendu est opposé.
 */
describe('errorInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let router: Router;

  const mockStorageService = {
    clear: jest.fn(),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: StorageService, useValue: mockStorageService },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    httpMock.verify();
    jest.clearAllMocks();
  });

  describe('401 sur un appel authentifié', () => {
    it('devrait purger le stockage et rediriger vers /auth/login', () => {
      httpClient.get('/api/admin/projects').subscribe({ error: () => undefined });

      httpMock
        .expectOne('/api/admin/projects')
        .flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(mockStorageService.clear).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
        queryParams: { returnUrl: router.url, reason: 'session_expired' },
      });
    });
  });

  // Régression : sans cette exclusion, chaque tentative ratée renaviguait vers
  // /auth/login avec l'URL courante en returnUrl — laquelle contenait déjà un
  // returnUrl. La chaîne doublait de longueur à chaque essai.
  describe('401 sur la requête de connexion', () => {
    it('ne devrait ni purger le stockage ni renaviguer', () => {
      httpClient
        .post('/api/auth/login', { email: 'a@b.c', password: 'x' })
        .subscribe({ error: () => undefined });

      httpMock
        .expectOne('/api/auth/login')
        .flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(mockStorageService.clear).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it("devrait tout de même propager l'erreur au composant", () => {
      const onError = jest.fn();

      httpClient.post('/api/auth/login', {}).subscribe({ error: onError });

      httpMock
        .expectOne('/api/auth/login')
        .flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
    });
  });

  describe('Autres statuts', () => {
    it('devrait rediriger vers la racine sur 403', () => {
      httpClient.get('/api/admin/projects').subscribe({ error: () => undefined });

      httpMock
        .expectOne('/api/admin/projects')
        .flush(null, { status: 403, statusText: 'Forbidden' });

      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });

    it('ne devrait pas rediriger sur 500', () => {
      httpClient.get('/api/projects').subscribe({ error: () => undefined });

      httpMock.expectOne('/api/projects').flush(null, { status: 500, statusText: 'Server Error' });

      expect(router.navigate).not.toHaveBeenCalled();
      expect(mockStorageService.clear).not.toHaveBeenCalled();
    });
  });
});
