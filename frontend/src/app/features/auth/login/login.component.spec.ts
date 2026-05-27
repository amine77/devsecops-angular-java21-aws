import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { LoginComponent } from './login.component';
import { AuthService } from '@core/services/auth.service';

/**
 * Tests du composant LoginComponent.
 *
 * Stratégie :
 * - On mock AuthService pour tester le composant isolément
 * - On teste le comportement (pas l'implémentation)
 * - On utilise TestBed uniquement pour le rendu Angular
 */
describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;

  const mockAuthService = {
    login: jest.fn(),
    isAuthenticated: jest.fn().mockReturnValue(false),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent, ReactiveFormsModule, RouterTestingModule, HttpClientTestingModule],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => jest.clearAllMocks());

  describe('Formulaire', () => {
    it('devrait être invalide quand vide', () => {
      expect(component['loginForm'].invalid).toBe(true);
    });

    it('devrait être invalide avec un email mal formaté', () => {
      component['loginForm'].patchValue({ email: 'notanemail', password: 'password' });
      expect(component['loginForm'].get('email')?.hasError('email')).toBe(true);
    });

    it('devrait être valide avec des données correctes', () => {
      component['loginForm'].patchValue({ email: 'test@test.com', password: 'password123' });
      expect(component['loginForm'].valid).toBe(true);
    });

    it('devrait marquer tous les champs touched à la soumission avec formulaire invalide', () => {
      component.onSubmit();
      expect(component['loginForm'].get('email')?.touched).toBe(true);
      expect(component['loginForm'].get('password')?.touched).toBe(true);
    });
  });

  describe('Soumission réussie', () => {
    it('ne devrait pas appeler login si le formulaire est invalide', () => {
      component.onSubmit();
      expect(mockAuthService.login).not.toHaveBeenCalled();
    });

    it('devrait appeler authService.login avec les credentials', () => {
      mockAuthService.login.mockReturnValue(of({ success: true, data: {}, timestamp: '' }));

      component['loginForm'].patchValue({ email: 'test@test.com', password: 'password123' });
      component.onSubmit();

      expect(mockAuthService.login).toHaveBeenCalledWith({
        email: 'test@test.com',
        password: 'password123',
      });
    });
  });

  describe('Gestion des erreurs', () => {
    it('devrait afficher un message d\'erreur pour 401', () => {
      mockAuthService.login.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 401 }))
      );

      component['loginForm'].patchValue({ email: 'test@test.com', password: 'wrongpassword' });
      component.onSubmit();

      expect(component['errorMessage']()).toContain('incorrect');
    });

    it('devrait afficher un message réseau pour erreur 0', () => {
      mockAuthService.login.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 0 }))
      );

      component['loginForm'].patchValue({ email: 'test@test.com', password: 'password123' });
      component.onSubmit();

      expect(component['errorMessage']()).toContain('inaccessible');
    });

    it('devrait désactiver le loading en cas d\'erreur', () => {
      mockAuthService.login.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 500 }))
      );

      component['loginForm'].patchValue({ email: 'test@test.com', password: 'password123' });
      component.onSubmit();

      expect(component['isLoading']()).toBe(false);
    });
  });

  describe('Messages de validation — emailErrors', () => {
    it('devrait retourner null si champ non touché', () => {
      expect(component.emailErrors).toBeNull();
    });

    it('devrait retourner message "obligatoire" si email vide et touché', () => {
      component['loginForm'].get('email')?.markAsTouched();
      component['loginForm'].patchValue({ email: '' });
      expect(component.emailErrors).toContain('obligatoire');
    });

    it('devrait retourner message "Format" si email invalide et touché', () => {
      component['loginForm'].get('email')?.markAsTouched();
      component['loginForm'].patchValue({ email: 'not-an-email' });
      expect(component.emailErrors).toContain('Format');
    });
  });

  describe('Messages de validation — passwordErrors', () => {
    it('devrait retourner null si champ non touché', () => {
      expect(component.passwordErrors).toBeNull();
    });

    it('devrait retourner message "obligatoire" si password vide et touché', () => {
      component['loginForm'].get('password')?.markAsTouched();
      component['loginForm'].patchValue({ password: '' });
      expect(component.passwordErrors).toContain('obligatoire');
    });

    it('devrait retourner message "Minimum 6" si password trop court et touché', () => {
      component['loginForm'].get('password')?.markAsTouched();
      component['loginForm'].patchValue({ password: 'abc' });
      expect(component.passwordErrors).toContain('Minimum 6');
    });

    it('devrait retourner null si password valide et touché', () => {
      component['loginForm'].get('password')?.markAsTouched();
      component['loginForm'].patchValue({ password: 'validpassword' });
      expect(component.passwordErrors).toBeNull();
    });
  });

  describe('Redirection si déjà authentifié', () => {
    it('devrait rediriger vers /admin si l\'utilisateur est déjà connecté', () => {
      mockAuthService.isAuthenticated.mockReturnValue(true);
      const router = TestBed.inject(Router);
      const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

      component.ngOnInit();

      expect(navigateSpy).toHaveBeenCalledWith(['/admin']);
    });

    it('ne devrait pas rediriger si l\'utilisateur n\'est pas connecté', () => {
      mockAuthService.isAuthenticated.mockReturnValue(false);
      const router = TestBed.inject(Router);
      const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

      component.ngOnInit();

      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });
});
