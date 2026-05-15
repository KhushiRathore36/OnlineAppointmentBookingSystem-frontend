import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';

import { AuthApiService } from '../core/auth-api.service';
import { AuthStore } from '../core/auth.store';
import { UserProfile } from '../core/models';
import { AuthPageComponent } from './auth.page';

describe('AuthPageComponent', () => {
  let fixture: ComponentFixture<AuthPageComponent>;
  let authApi: jest.Mocked<Pick<AuthApiService, 'register' | 'login'>>;
  let authStore: jest.Mocked<Pick<AuthStore, 'setSession' | 'loadProfile'>>;
  let router: jest.Mocked<Pick<Router, 'navigate'>>;

  const profile: UserProfile = {
    userId: 1,
    fullName: 'Navya Saxena',
    email: 'khushir@gmail.com',
    phone: '9888888887',
    role: 'PATIENT'
  };

  beforeEach(async () => {
    authApi = {
      register: jest.fn(),
      login: jest.fn()
    };
    authStore = {
      setSession: jest.fn(),
      loadProfile: jest.fn()
    };
    router = {
      navigate: jest.fn()
    };

    await TestBed.configureTestingModule({
      imports: [AuthPageComponent],
      providers: [
        { provide: AuthApiService, useValue: authApi },
        { provide: AuthStore, useValue: authStore },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(convertToParamMap({}))
          }
        }
      ]
    }).compileComponents();

    authStore.setSession.mockReturnValue(true);
    authStore.loadProfile.mockReturnValue(of(profile));
    authApi.register.mockReturnValue(of({ token: 'jwt-token', message: 'User registered successfully' }));

    fixture = TestBed.createComponent(AuthPageComponent);
    fixture.detectChanges();
  });

  it('registers with the latest typed form values instead of stale autofill values', () => {
    (fixture.componentInstance as any).setMode('register');
    fixture.detectChanges();

    setInputValue('medibook-register-full-name', '  Navya Saxena  ');
    setInputValue('medibook-register-email', '  KhushiR@GMAIL.COM  ');
    setInputValue('medibook-register-phone', ' 98888-88887 ');
    setInputValue('medibook-register-password', 'password123');
    setSelectValue('medibook-register-role', 'PATIENT');

    const form = fixture.nativeElement.querySelector('form.auth-form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(authApi.register).toHaveBeenCalledWith({
      fullName: 'Navya Saxena',
      email: 'khushir@gmail.com',
      phone: '9888888887',
      password: 'password123',
      role: 'PATIENT'
    });
    expect(authStore.setSession).toHaveBeenCalledWith('jwt-token');
    expect(router.navigate).toHaveBeenCalledWith(['/discover']);
  });

  it('shows a useful message when register form values are invalid', () => {
    (fixture.componentInstance as any).setMode('register');
    fixture.detectChanges();

    setInputValue('medibook-register-full-name', 'Na');
    setInputValue('medibook-register-email', 'not-an-email');
    setInputValue('medibook-register-phone', '123');
    setInputValue('medibook-register-password', '123');

    const form = fixture.nativeElement.querySelector('form.auth-form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(authApi.register).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      'Please name, valid email, 10 digit phone, password aur role sahi se fill karein.'
    );
  });

  function setInputValue(name: string, value: string): void {
    const input = fixture.nativeElement.querySelector(`[name="${name}"]`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function setSelectValue(name: string, value: string): void {
    const select = fixture.nativeElement.querySelector(`[name="${name}"]`) as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }
});
