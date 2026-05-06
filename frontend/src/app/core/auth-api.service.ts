import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';

import { AuthResponse, LoginPayload, RegisterPayload, UserProfile } from './models';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);

  register(payload: RegisterPayload) {
    return this.http.post<AuthResponse>('/api/auth/register', payload);
  }

  login(payload: LoginPayload) {
    return this.http.post<AuthResponse>('/api/auth/login', payload);
  }

  completeOAuthRole(email: string, role: string) {
    const params = new HttpParams().set('email', email).set('role', role);
    return this.http.post<AuthResponse>('/api/auth/oauth-role', {}, { params });
  }

  getProfile() {
    return this.http.get<UserProfile>('/api/auth/profile');
  }
}
