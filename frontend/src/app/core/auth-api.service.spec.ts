import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthApiService } from './auth-api.service';

describe('AuthApiService', () => {
  let service: AuthApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(AuthApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('posts register payload to the auth register endpoint', () => {
    const payload = {
      fullName: 'Navya Saxena',
      email: 'navya@example.com',
      phone: '9876543210',
      password: 'secret123',
      role: 'PATIENT' as const
    };

    service.register(payload).subscribe((response) => {
      expect(response.token).toBe('jwt-token');
    });

    const request = httpMock.expectOne('/api/auth/register');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush({ token: 'jwt-token', message: 'User registered successfully' });
  });

  it('gets the current profile from the auth profile endpoint', () => {
    service.getProfile().subscribe((profile) => {
      expect(profile.email).toBe('navya@example.com');
    });

    const request = httpMock.expectOne('/api/auth/profile');
    expect(request.request.method).toBe('GET');
    request.flush({
      userId: 1,
      fullName: 'Navya Saxena',
      email: 'navya@example.com',
      phone: '9876543210',
      role: 'PATIENT'
    });
  });
});
