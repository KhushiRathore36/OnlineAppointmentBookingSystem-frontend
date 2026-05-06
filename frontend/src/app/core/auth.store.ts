import { computed, inject, Injectable, signal } from '@angular/core';
import { EMPTY } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AuthApiService } from './auth-api.service';
import { UserProfile, UserRole } from './models';

const TOKEN_KEY = 'doctor-appointment.token';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly authApi = inject(AuthApiService);

  readonly token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  readonly user = signal<UserProfile | null>(null);
  readonly role = computed<UserRole | null>(() => {
    const profileRole = this.user()?.role;
    return profileRole ?? this.extractRole(this.token());
  });
  readonly isPatient = computed(() => this.role() === 'PATIENT');

  setSession(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    this.token.set(token);
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
    if (!this.token() || this.user()) {
      return;
    }

    this.authApi
      .getProfile()
      .pipe(
        catchError(() => {
          this.clear();
          return EMPTY;
        })
      )
      .subscribe((profile) => this.user.set(profile));
  }

  private extractRole(token: string | null): UserRole | null {
    if (!token) {
      return null;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return (payload.role as UserRole) || null;
    } catch {
      return null;
    }
  }
}
