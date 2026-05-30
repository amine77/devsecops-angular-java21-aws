import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { authGuard, adminGuard } from './auth.guard';
import { AuthService } from '@core/services/auth.service';

describe("Guards d'authentification", () => {
  let router: Router;
  let navigateSpy: jest.SpyInstance;

  const mockAuthService = {
    isAuthenticated: jest.fn(),
    isAdmin: jest.fn(),
  };

  const mockRoute = {} as ActivatedRouteSnapshot;
  const mockState = { url: '/admin/dashboard' } as RouterStateSnapshot;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    });

    router = TestBed.inject(Router);
    navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => jest.clearAllMocks());

  describe('authGuard', () => {
    it("devrait retourner true si l'utilisateur est authentifié", () => {
      mockAuthService.isAuthenticated.mockReturnValue(true);

      const result = TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));

      expect(result).toBe(true);
      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('devrait retourner false et rediriger vers /auth/login si non authentifié', () => {
      mockAuthService.isAuthenticated.mockReturnValue(false);

      const result = TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));

      expect(result).toBe(false);
      expect(navigateSpy).toHaveBeenCalledWith(['/auth/login'], {
        queryParams: { returnUrl: '/admin/dashboard' },
      });
    });

    it("devrait inclure l'URL courante comme returnUrl", async () => {
      mockAuthService.isAuthenticated.mockReturnValue(false);
      const customState = { url: '/admin/projects/edit/42' } as RouterStateSnapshot;

      await TestBed.runInInjectionContext(() => authGuard(mockRoute, customState));

      expect(navigateSpy).toHaveBeenCalledWith(['/auth/login'], {
        queryParams: { returnUrl: '/admin/projects/edit/42' },
      });
    });
  });

  describe('adminGuard', () => {
    it("devrait retourner true si l'utilisateur est admin", () => {
      mockAuthService.isAdmin.mockReturnValue(true);

      const result = TestBed.runInInjectionContext(() => adminGuard(mockRoute, mockState));

      expect(result).toBe(true);
      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('devrait retourner false et rediriger vers /auth/login si non authentifié', () => {
      mockAuthService.isAdmin.mockReturnValue(false);
      mockAuthService.isAuthenticated.mockReturnValue(false);

      const result = TestBed.runInInjectionContext(() => adminGuard(mockRoute, mockState));

      expect(result).toBe(false);
      expect(navigateSpy).toHaveBeenCalledWith(['/auth/login'], {
        queryParams: { returnUrl: '/admin/dashboard' },
      });
    });

    it('devrait retourner false et rediriger vers / si authentifié mais non admin', () => {
      mockAuthService.isAdmin.mockReturnValue(false);
      mockAuthService.isAuthenticated.mockReturnValue(true);

      const result = TestBed.runInInjectionContext(() => adminGuard(mockRoute, mockState));

      expect(result).toBe(false);
      expect(navigateSpy).toHaveBeenCalledWith(['/']);
    });

    it('ne devrait pas rediriger vers /auth/login si authentifié mais pas admin', async () => {
      mockAuthService.isAdmin.mockReturnValue(false);
      mockAuthService.isAuthenticated.mockReturnValue(true);

      await TestBed.runInInjectionContext(() => adminGuard(mockRoute, mockState));

      expect(navigateSpy).not.toHaveBeenCalledWith(
        expect.arrayContaining(['/auth/login']),
        expect.anything()
      );
    });
  });
});
