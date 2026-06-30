import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import gsap from 'gsap';

import { LanguageService } from '@core/services/language.service';
import { AuthService } from '@core/services/auth.service';
import { ScrollAnimationService } from '@core/animation/scroll-animation.service';
import { TranslatePipe } from '@core/pipes/translate.pipe';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    TranslatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly lang = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly scrollAnim = inject(ScrollAnimationService);
  private readonly ngZone = inject(NgZone);
  private readonly el = inject(ElementRef<HTMLElement>);

  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly hidePassword = signal(true);

  private returnUrl = '/admin';
  private entryTl?: gsap.core.Timeline;

  protected readonly loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      void this.router.navigate([this.returnUrl]);
      return;
    }
    this.returnUrl =
      (this.route.snapshot.queryParams['returnUrl'] as string | undefined) ?? '/admin';
  }

  ngAfterViewInit(): void {
    if (this.scrollAnim.reducedMotion) return;
    this.animateEntry();
  }

  ngOnDestroy(): void {
    this.entryTl?.kill();
  }

  private animateEntry(): void {
    const card = this.el.nativeElement.querySelector('.login-card');
    const shield = this.el.nativeElement.querySelector('.login-shield');
    if (!card) return;

    this.ngZone.runOutsideAngular(() => {
      this.entryTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      this.entryTl
        .from(card, { opacity: 0, y: 40, scale: 0.96, duration: 0.7 })
        .from(shield, { opacity: 0, scale: 0.6, rotate: -15, duration: 0.5 }, '-=0.4');
    });
  }

  protected togglePassword(): void {
    this.hidePassword.update((v) => !v);
  }

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
          this.errorMessage.set(this.lang.translate('auth.login.error.credentials'));
        } else if (err.status === 0) {
          this.errorMessage.set(this.lang.translate('auth.login.error.server'));
        } else {
          this.errorMessage.set(this.lang.translate('auth.login.error.generic'));
        }
      },
    });
  }
}
