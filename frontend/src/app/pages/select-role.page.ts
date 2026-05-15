import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthApiService } from '../core/auth-api.service';
import { AuthStore } from '../core/auth.store';
import { UserRole } from '../core/models';

@Component({
  selector: 'app-select-role-page',
  imports: [CommonModule],
  templateUrl: './select-role.page.html',
  styleUrl: './select-role.page.scss'
})
export class SelectRolePageComponent {
  private readonly authApi = inject(AuthApiService);
  private readonly authStore = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly roles: Array<{ label: string; role: UserRole; note: string }> = [
    { label: 'Patient', role: 'PATIENT', note: 'Book appointments, pay online, and manage visits.' },
    { label: 'Doctor', role: 'PROVIDER', note: 'Manage slots, appointments, and your provider workspace.' }
  ];
  protected email = '';
  protected busyRole: UserRole | null = null;
  protected statusMessage = '';

  constructor() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.email = params.get('email') || '';
        if (!this.email) {
          this.statusMessage = 'Google login details missing hain. Please login again.';
        }
      });
  }

  protected chooseRole(role: UserRole): void {
    if (!this.email) {
      return;
    }

    this.busyRole = role;
    this.statusMessage = '';

    this.authApi
      .completeOAuthRole(this.email, role)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (!this.authStore.setSession(response.token)) {
            this.busyRole = null;
            this.statusMessage = 'Login token receive nahi hua. Please dubara try karein.';
            return;
          }

          this.authStore
            .loadProfile()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((profile) => {
              this.busyRole = null;
              const nextRole = profile?.role ?? role;
              void this.router.navigate([nextRole === 'PATIENT' ? '/discover' : '/dashboard']);
            });
        },
        error: (error) => {
          this.busyRole = null;
          this.statusMessage = error?.error?.message || 'Role save nahi ho paya. Please dubara try karein.';
        }
      });
  }
}
