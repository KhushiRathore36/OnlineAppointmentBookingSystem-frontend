import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AuthApiService } from './auth-api.service';
import { AuthStore } from './auth.store';
import { UserProfile } from './models';

describe('AuthStore', () => {
  let authApi: jasmine.SpyObj<AuthApiService>;

  const profile: UserProfile = {
    userId: 1,
    fullName: 'Priya Mehta',
    email: 'priya@example.com',
    phone: '9876543210',
    role: 'PATIENT'
  };

  beforeEach(() => {
    localStorage.clear();
    authApi = jasmine.createSpyObj<AuthApiService>('AuthApiService', ['getProfile']);

    TestBed.configureTestingModule({
      providers: [
        AuthStore,
        { provide: AuthApiService, useValue: authApi }
      ]
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('stores and clears the current session', () => {
    const store = TestBed.inject(AuthStore);

    store.setSession('session-token');
    store.setProfile(profile);

    expect(localStorage.getItem('doctor-appointment.token')).toBe('session-token');
    expect(store.token()).toBe('session-token');
    expect(store.user()).toEqual(profile);

    store.clear();

    expect(localStorage.getItem('doctor-appointment.token')).toBeNull();
    expect(store.token()).toBeNull();
    expect(store.user()).toBeNull();
  });

  it('restores a profile when a token exists', () => {
    localStorage.setItem('doctor-appointment.token', 'session-token');
    authApi.getProfile.and.returnValue(of(profile));

    const store = TestBed.inject(AuthStore);
    store.restoreProfile();

    expect(authApi.getProfile).toHaveBeenCalled();
    expect(store.user()).toEqual(profile);
  });

  it('clears the session when profile restore fails', () => {
    localStorage.setItem('doctor-appointment.token', 'expired-token');
    authApi.getProfile.and.returnValue(throwError(() => new Error('Unauthorized')));

    const store = TestBed.inject(AuthStore);
    store.restoreProfile();

    expect(store.token()).toBeNull();
    expect(store.user()).toBeNull();
    expect(localStorage.getItem('doctor-appointment.token')).toBeNull();
  });

  it('derives the role from a jwt payload before the profile is loaded', () => {
    const payload = btoa(JSON.stringify({ role: 'PROVIDER' }));
    const store = TestBed.inject(AuthStore);

    store.setSession(`header.${payload}.signature`);

    expect(store.role()).toBe('PROVIDER');
    expect(store.isPatient()).toBeFalse();
  });
});
