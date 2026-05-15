import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

import { AuthApiService } from './auth-api.service';
import { UserProfile, UserRole } from './models';

const TOKEN_KEY = 'doctor-appointment.token';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly authApi = inject(AuthApiService);

  readonly token = signal<string | null>(this.readStoredToken());
  readonly user = signal<UserProfile | null>(null);
  readonly role = computed<UserRole | null>(() => {
    const profileRole = this.user()?.role;
    return profileRole ?? this.extractRole(this.token());
  });
  readonly isPatient = computed(() => this.role() === 'PATIENT');

  setSession(token: string | null | undefined): boolean {
    const normalizedToken = this.normalizeToken(token);

    if (!normalizedToken) {
      this.clear();
      return false;
    }

    localStorage.setItem(TOKEN_KEY, normalizedToken);
    this.token.set(normalizedToken);
    return true;
  }

  setProfile(profile: UserProfile): void {
    this.user.set(profile);
  }

  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.token.set(null);
    this.user.set(null);
  }

  restoreProfile(): void {
    this.loadProfile().subscribe();
  }

  loadProfile(): Observable<UserProfile | null> {
    if (!this.token() || this.user()) {
      return of(this.user());
    }

    return this.authApi
      .getProfile()
      .pipe(
        tap((profile) => this.user.set(profile)),
        catchError(() => {
          this.clear();
          return of(null);
        })
      );
  }

  private extractRole(token: string | null): UserRole | null {
    try {
      const payload = this.decodeJwtPayload(token);
      return (payload['role'] as UserRole) || null;
    } catch {
      return null;
    }
  }

  private readStoredToken(): string | null {
    const token = this.normalizeToken(localStorage.getItem(TOKEN_KEY));

    if (!token) {
      localStorage.removeItem(TOKEN_KEY);
    }

    return token;
  }

  private normalizeToken(token: string | null | undefined): string | null {
    const normalizedToken = token?.trim();

    if (!normalizedToken) {
      return null;
    }

    try {
      this.decodeJwtPayload(normalizedToken);
      return normalizedToken;
    } catch {
      return null;
    }
  }

  private decodeJwtPayload(token: string | null): Record<string, unknown> {
    const payload = token?.split('.')[1];

    if (!payload) {
      throw new Error('Invalid JWT');
    }

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedBase64 = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    return JSON.parse(atob(paddedBase64));
  }
}
