import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';
import { AuthStore } from './core/auth.store';
import { UserProfile } from './core/models';

describe('App', () => {
  let token: ReturnType<typeof signal<string | null>>;
  let user: ReturnType<typeof signal<UserProfile | null>>;
  let authStore: jasmine.SpyObj<AuthStore>;

  beforeEach(async () => {
    token = signal<string | null>(null);
    user = signal<UserProfile | null>(null);
    authStore = jasmine.createSpyObj<AuthStore>('AuthStore', ['restoreProfile', 'clear'], {
      token,
      user
    });

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: authStore }
      ]
    }).compileComponents();
  });

  it('creates the app and restores the profile on startup', () => {
    const fixture = TestBed.createComponent(App);

    expect(fixture.componentInstance).toBeTruthy();
    expect(authStore.restoreProfile).toHaveBeenCalled();
  });

  it('shows login actions for guests', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.brand strong')?.textContent).toContain('MediBook');
    expect(compiled.querySelector('.ghost-button')?.textContent).toContain('Login');
    expect(compiled.querySelector('.primary-button')?.textContent).toContain('Book now');
  });

  it('shows provider workspace actions when a provider is signed in', () => {
    token.set('jwt-token');
    user.set({
      userId: 7,
      fullName: 'Dr Asha Sharma',
      email: 'asha@example.com',
      phone: '9876543210',
      role: 'PROVIDER'
    });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.nav-links a:nth-child(3)')?.textContent).toContain('Workspace');
    expect(compiled.querySelector('.user-chip strong')?.textContent).toContain('Dr Asha Sharma');
    expect(compiled.querySelector('.primary-button')?.textContent).toContain('Open workspace');
  });

  it('clears the session when logout is clicked', () => {
    token.set('jwt-token');

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const logoutButton = fixture.nativeElement.querySelector('.ghost-button') as HTMLButtonElement;
    logoutButton.click();

    expect(authStore.clear).toHaveBeenCalled();
  });
});
