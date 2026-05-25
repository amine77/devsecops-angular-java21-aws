import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { AuthService } from './auth.service';
import { StorageService } from './storage.service';
import { environment } from '@environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let storageService: jest.Mocked<StorageService>;

  const mockStorageService: jest.Mocked<Partial<StorageService>> = {
    getToken: jest.fn().mockReturnValue(null),
    setToken: jest.fn(),
    setItem: jest.fn(),
    getItem: jest.fn().mockReturnValue(null),
    clear: jest.fn(),
    get userKey() { return 'portfolio_user'; },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      providers: [
        AuthService,
        { provide: StorageService, useValue: mockStorageService },
      ],
    });
    service = TestBed.inject(AuthService);
    storageService = TestBed.inject(StorageService) as jest.Mocked<StorageService>;
  });

  afterEach(() => jest.clearAllMocks());

  describe('État initial', () => {
    it('devrait être non authentifié par défaut', () => {
      expect(service.isAuthenticated()).toBe(false);
    });

    it('devrait ne pas être admin par défaut', () => {
      expect(service.isAdmin()).toBe(false);
    });

    it('devrait avoir un displayName null par défaut', () => {
      expect(service.displayName()).toBeNull();
    });
  });

  describe('Signals — état réactif', () => {
    it('isAuthenticated() devrait refléter l\'état du currentUser', () => {
      // Initialement null → non authentifié
      expect(service.isAuthenticated()).toBe(false);

      // On ne peut pas directement setter le signal privé,
      // mais on peut tester via login()
    });
  });

  describe('getToken()', () => {
    it('devrait déléguer à StorageService', () => {
      mockStorageService.getToken.mockReturnValue('test-token');
      expect(service.getToken()).toBe('test-token');
      expect(storageService.getToken).toHaveBeenCalled();
    });
  });
});
