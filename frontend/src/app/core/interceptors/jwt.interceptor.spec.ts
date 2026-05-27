import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { jwtInterceptor } from './jwt.interceptor';
import { StorageService } from '@core/services/storage.service';

describe('jwtInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;

  const mockStorageService = {
    getToken: jest.fn(),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting(),
        { provide: StorageService, useValue: mockStorageService },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    jest.clearAllMocks();
  });

  describe('Sans token (endpoint public)', () => {
    it('devrait passer la requête sans header Authorization', () => {
      mockStorageService.getToken.mockReturnValue(null);

      httpClient.get('/api/projects').subscribe();

      const req = httpMock.expectOne('/api/projects');
      expect(req.request.headers.has('Authorization')).toBe(false);
      req.flush([]);
    });

    it('ne devrait pas modifier le body de la requête', () => {
      mockStorageService.getToken.mockReturnValue(null);
      const body = { email: 'test@test.com', password: 'pass' };

      httpClient.post('/api/auth/login', body).subscribe();

      const req = httpMock.expectOne('/api/auth/login');
      expect(req.request.body).toEqual(body);
      expect(req.request.headers.has('Authorization')).toBe(false);
      req.flush({ success: true });
    });
  });

  describe('Avec token (endpoint protégé)', () => {
    it('devrait injecter le header Authorization: Bearer <token>', () => {
      mockStorageService.getToken.mockReturnValue('my-jwt-token');

      httpClient.get('/api/admin/projects').subscribe();

      const req = httpMock.expectOne('/api/admin/projects');
      expect(req.request.headers.get('Authorization')).toBe('Bearer my-jwt-token');
      req.flush([]);
    });

    it('ne devrait pas modifier la requête originale (immutabilité)', () => {
      mockStorageService.getToken.mockReturnValue('token-xyz');
      const body = { title: 'Nouveau projet' };

      httpClient.post('/api/projects', body).subscribe();

      const req = httpMock.expectOne('/api/projects');
      expect(req.request.headers.get('Authorization')).toBe('Bearer token-xyz');
      expect(req.request.body).toEqual(body);
      expect(req.request.method).toBe('POST');
      req.flush({ success: true });
    });

    it('devrait fonctionner pour les méthodes PUT et DELETE', () => {
      mockStorageService.getToken.mockReturnValue('admin-token');

      httpClient.delete('/api/projects/42').subscribe();

      const req = httpMock.expectOne('/api/projects/42');
      expect(req.request.headers.get('Authorization')).toBe('Bearer admin-token');
      req.flush(null, { status: 204, statusText: 'No Content' });
    });
  });
});
