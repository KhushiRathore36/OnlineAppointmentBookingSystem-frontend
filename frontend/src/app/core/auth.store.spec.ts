import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AuthApiService } from './auth-api.service';
import { AuthStore } from './auth.store';
import { UserProfile } from './models';

describe('AuthStore', () => {
  let authApi: jest.Mocked<Pick<AuthApiService, 'getProfile'>>;
  const jwtWithRole = (role = 'PATIENT') => `header.${btoa(JSON.stringify({ role }))}.signature`;

  const profile: UserProfile = {
    userId: 1,
    fullName: 'Priya Mehta',
    email: 'priya@example.com',
    phone: '9876543210',
    role: 'PATIENT'
  };

  beforeEach(() => {
    localStorage.clear();
    authApi = {
      getProfile: jest.fn()
    };

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
    const token = jwtWithRole();

    expect(store.setSession(token)).toBe(true);
    store.setProfile(profile);

    expect(localStorage.getItem('doctor-appointment.token')).toBe(token);
    expect(store.token()).toBe(token);
    expect(store.user()).toEqual(profile);

    store.clear();

    expect(localStorage.getItem('doctor-appointment.token')).toBeNull();
    expect(store.token()).toBeNull();
    expect(store.user()).toBeNull();
  });

  it('loads a profile when a token exists', (done) => {
    localStorage.setItem('doctor-appointment.token', jwtWithRole());
    authApi.getProfile.mockReturnValue(of(profile));

    const store = TestBed.inject(AuthStore);
    store.loadProfile().subscribe((loadedProfile) => {
      expect(authApi.getProfile).toHaveBeenCalled();
      expect(loadedProfile).toEqual(profile);
      expect(store.user()).toEqual(profile);
      done();
    });
  });

  it('clears the session when profile loading fails', (done) => {
    localStorage.setItem('doctor-appointment.token', jwtWithRole());
    authApi.getProfile.mockReturnValue(throwError(() => new Error('Unauthorized')));

    const store = TestBed.inject(AuthStore);
    store.loadProfile().subscribe((loadedProfile) => {
      expect(loadedProfile).toBeNull();
      expect(store.token()).toBeNull();
      expect(store.user()).toBeNull();
      expect(localStorage.getItem('doctor-appointment.token')).toBeNull();
      done();
    });
  });

  it('does not store invalid session tokens', () => {
    const store = TestBed.inject(AuthStore);

    expect(store.setSession('not-a-jwt')).toBe(false);
    expect(store.token()).toBeNull();
    expect(localStorage.getItem('doctor-appointment.token')).toBeNull();
  });
});
