import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';

import { AuthService } from './auth.service';
import { StorageService } from './storage.service';
import { ApiResponse } from '@shared/models/api-response.model';
import { AuthResponse, UserInfo } from '@shared/models/auth.model';

describe('AuthService', () => {
  let service: AuthService;
  let storageService: jest.Mocked<StorageService>;
  let httpMock: HttpTestingController;
  let router: Router;

  const mockUser: UserInfo = {
    id: 1,
    email: 'admin@portfolio.dev',
    firstName: 'Admin',
    lastName: 'Portfolio',
    role: 'ADMIN',
  };

  const mockStorageService: jest.Mocked<Partial<StorageService>> = {
    getToken: jest.fn().mockReturnValue(null),
    setToken: jest.fn(),
    setItem: jest.fn(),
    getItem: jest.fn().mockReturnValue(null),
    clear: jest.fn(),
    get userKey() {
      return 'portfolio_user';
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (mockStorageService.getItem as jest.Mock).mockReturnValue(null);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      providers: [AuthService, { provide: StorageService, useValue: mockStorageService }],
    });
    service = TestBed.inject(AuthService);
    storageService = TestBed.inject(StorageService) as jest.Mocked<StorageService>;
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('État initial (aucun user en storage)', () => {
    it('devrait être non authentifié par défaut', () => {
      expect(service.isAuthenticated()).toBe(false);
    });

    it('devrait ne pas être admin par défaut', () => {
      expect(service.isAdmin()).toBe(false);
    });

    it('devrait avoir un displayName null par défaut', () => {
      expect(service.displayName()).toBeNull();
    });

    it('currentUser devrait être null par défaut', () => {
      expect(service.currentUser()).toBeNull();
    });
  });

  describe('État initial (user présent en storage)', () => {
    it('devrait être authentifié si le localStorage contient un utilisateur', () => {
      (mockStorageService.getItem as jest.Mock).mockReturnValue(mockUser);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule, RouterTestingModule],
        providers: [AuthService, { provide: StorageService, useValue: mockStorageService }],
      });
      const freshService = TestBed.inject(AuthService);
      TestBed.inject(HttpTestingController).verify();

      expect(freshService.isAuthenticated()).toBe(true);
      expect(freshService.currentUser()).toEqual(mockUser);
      expect(freshService.displayName()).toBe('Admin Portfolio');
    });
  });

  describe('getToken()', () => {
    it('devrait déléguer à StorageService', () => {
      (mockStorageService.getToken as jest.Mock).mockReturnValue('test-token');
      expect(service.getToken()).toBe('test-token');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(storageService.getToken).toHaveBeenCalled();
    });
  });

  describe('login()', () => {
    const loginResponse: ApiResponse<AuthResponse> = {
      success: true,
      data: {
        token: 'jwt-token-abc123',
        tokenType: 'Bearer',
        expiresIn: 86400,
        user: mockUser,
      },
      timestamp: '2024-01-01T00:00:00',
    };

    it('devrait stocker le token et mettre à jour le signal après login réussi', () => {
      service.login({ email: 'admin@portfolio.dev', password: 'Admin@2024!' }).subscribe();

      const req = httpMock.expectOne((r) => r.url.includes('/auth/login'));
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        email: 'admin@portfolio.dev',
        password: 'Admin@2024!',
      });
      req.flush(loginResponse);

      expect(storageService.setToken).toHaveBeenCalledWith('jwt-token-abc123');
      expect(storageService.setItem).toHaveBeenCalledWith('portfolio_user', mockUser);
      expect(service.isAuthenticated()).toBe(true);
      expect(service.isAdmin()).toBe(true);
      expect(service.displayName()).toBe('Admin Portfolio');
      expect(service.currentUser()).toEqual(mockUser);
    });

    it("devrait propager l'erreur HTTP sans modifier l'état", () => {
      let caughtError: unknown;
      service.login({ email: 'bad@test.com', password: 'wrong' }).subscribe({
        error: (err) => {
          caughtError = err;
        },
      });

      const req = httpMock.expectOne((r) => r.url.includes('/auth/login'));
      req.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

      expect(storageService.setToken).not.toHaveBeenCalled();
      expect(storageService.setItem).not.toHaveBeenCalled();
      expect(service.isAuthenticated()).toBe(false);
      expect(caughtError).toBeDefined();
    });

    it("ne devrait pas modifier l'état si response.success est false", () => {
      const failureResponse: ApiResponse<AuthResponse> = {
        success: false,
        message: 'Credentials invalides',
        timestamp: '2024-01-01T00:00:00',
      };

      service.login({ email: 'admin@portfolio.dev', password: 'wrong' }).subscribe();

      const req = httpMock.expectOne((r) => r.url.includes('/auth/login'));
      req.flush(failureResponse);

      expect(storageService.setToken).not.toHaveBeenCalled();
      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('logout()', () => {
    it('devrait vider le storage et réinitialiser le signal à null', () => {
      // Arrange : se connecter d'abord
      service.login({ email: 'admin@portfolio.dev', password: 'Admin@2024!' }).subscribe();
      const req = httpMock.expectOne((r) => r.url.includes('/auth/login'));
      req.flush({
        success: true,
        data: { token: 'jwt', tokenType: 'Bearer', expiresIn: 86400, user: mockUser },
        timestamp: '',
      });
      expect(service.isAuthenticated()).toBe(true);

      // Act
      const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
      service.logout();

      // Assert
      expect(storageService.clear).toHaveBeenCalled();
      expect(service.isAuthenticated()).toBe(false);
      expect(service.currentUser()).toBeNull();
      expect(navigateSpy).toHaveBeenCalledWith(['/auth/login']);
    });
  });

  describe('Signals — état réactif', () => {
    it('isAuthenticated() devrait passer à true après un login réussi', () => {
      expect(service.isAuthenticated()).toBe(false);

      service.login({ email: 'admin@portfolio.dev', password: 'pass' }).subscribe();
      httpMock
        .expectOne((r) => r.url.includes('/auth/login'))
        .flush({
          success: true,
          data: { token: 'tok', tokenType: 'Bearer', expiresIn: 86400, user: mockUser },
          timestamp: '',
        });

      expect(service.isAuthenticated()).toBe(true);
    });
  });
});
