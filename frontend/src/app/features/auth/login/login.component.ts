import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '@core/services/auth.service';

/**
 * Composant de connexion.
 *
 * Utilise Reactive Forms (FormBuilder) plutôt que Template-driven Forms.
 * Raisons des Reactive Forms pour un dev senior :
 * - Validations centralisées dans le composant (pas dans le template)
 * - Testabilité : on peut tester la validation sans rendu
 * - Typage fort avec FormGroup<{...}>
 * - Gestion asynchrone plus naturelle
 *
 * Signals pour l'état local :
 * - isLoading : affichage du spinner pendant l'appel API
 * - errorMessage : message d'erreur de l'API
 *
 * Avantage vs propriétés normales :
 * - Avec OnPush, les Signals déclenchent automatiquement la re-détection
 * - Pas besoin de ChangeDetectorRef.markForCheck()
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private returnUrl = '/admin';

  protected readonly loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  ngOnInit(): void {
    // Si déjà connecté → redirect direct
    if (this.authService.isAuthenticated()) {
      void this.router.navigate([this.returnUrl]);
      return;
    }
    // Récupère l'URL de retour depuis les query params
    this.returnUrl = (this.route.snapshot.queryParams['returnUrl'] as string | undefined) ?? '/admin';
  }

  /**
   * Soumission du formulaire.
   *
   * Flux :
   * 1. Valide le formulaire
   * 2. Appel AuthService.login()
   * 3. Succès → navigate vers returnUrl
   * 4. Erreur → affiche message d'erreur
   */
  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const credentials = {
      email: this.loginForm.value.email!,
      password: this.loginForm.value.password!,
    };

    this.authService.login(credentials).subscribe({
      next: () => {
        void this.router.navigate([this.returnUrl]);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        if (err.status === 401) {
          this.errorMessage.set('Email ou mot de passe incorrect.');
        } else if (err.status === 0) {
          this.errorMessage.set('Serveur inaccessible. Réessayez dans quelques instants.');
        } else {
          this.errorMessage.set('Une erreur est survenue. Réessayez.');
        }
      },
    });
  }

  /** Helpers pour les messages de validation dans le template. */
  get emailErrors(): string | null {
    const ctrl = this.loginForm.get('email');
    if (!ctrl?.touched || ctrl.valid) return null;
    if (ctrl.hasError('required')) return "L'email est obligatoire.";
    if (ctrl.hasError('email')) return 'Format d\'email invalide.';
    return null;
  }

  get passwordErrors(): string | null {
    const ctrl = this.loginForm.get('password');
    if (!ctrl?.touched || ctrl.valid) return null;
    if (ctrl.hasError('required')) return 'Le mot de passe est obligatoire.';
    if (ctrl.hasError('minlength')) return 'Minimum 6 caractères.';
    return null;
  }
}
