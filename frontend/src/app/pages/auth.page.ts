import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthApiService } from '../core/auth-api.service';
import { AuthStore } from '../core/auth.store';
import { UserRole } from '../core/models';

@Component({
  selector: 'app-auth-page',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './auth.page.html',
  styleUrl: './auth.page.scss'
})
export class AuthPageComponent {
  private readonly authApi = inject(AuthApiService);
  private readonly authStore = inject(AuthStore);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected mode: 'login' | 'register' = 'login';
  protected statusMessage = '';
  protected busy = false;
  protected readonly roles: UserRole[] = ['PATIENT', 'PROVIDER'];

  protected readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  protected readonly registerForm = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.minLength(10)]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    role: ['PATIENT' as UserRole, Validators.required]
  });

  constructor() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const token = params.get('token');
        const oauthError = params.get('oauthError');

        if (oauthError === 'email_not_found') {
          this.statusMessage = 'Google account se email read nahi ho paya. Please dusra account try karein.';
          return;
        }

        if (!token) {
          return;
        }

        this.authStore.setSession(token);
        this.authStore.restoreProfile();
        void this.router.navigate(['/dashboard']);
      });
  }

  protected setMode(mode: 'login' | 'register'): void {
    this.mode = mode;
    this.statusMessage = '';
  }

  protected submitLogin(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.busy = true;
    this.statusMessage = '';

    this.authApi
      .login(this.loginForm.getRawValue())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.authStore.setSession(response.token);
          this.authStore.restoreProfile();
          this.busy = false;
          this.router.navigate(['/dashboard']);
        },
        error: (error) => {
          this.busy = false;
          this.statusMessage = error?.error?.message || 'Login failed. Please verify your credentials.';
        }
      });
  }

  protected submitRegister(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.busy = true;
    this.statusMessage = '';

    this.authApi
      .register(this.registerForm.getRawValue())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.authStore.setSession(response.token);
          this.authStore.restoreProfile();
          this.busy = false;
          this.router.navigate([this.registerForm.getRawValue().role === 'PATIENT' ? '/discover' : '/dashboard']);
        },
        error: (error) => {
          this.busy = false;
          this.statusMessage = error?.error?.message || 'Registration failed. Please check your details and try again.';
        }
      });
  }

  protected continueWithGoogle(): void {
    window.location.href = 'http://localhost:8080/oauth2/authorization/google';
  }
}
