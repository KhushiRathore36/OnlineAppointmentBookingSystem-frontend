import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthStore } from './core/auth.store';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly authStore = inject(AuthStore);

  protected readonly user = this.authStore.user;
  protected readonly isLoggedIn = computed(() => !!this.authStore.token());
  protected readonly isAdmin = computed(() => this.authStore.user()?.role === 'ADMIN');
  protected readonly workspaceLabel = computed(() => {
    const role = this.authStore.user()?.role;
    if (role === 'ADMIN') {
      return 'Admin';
    }
    if (role === 'PROVIDER') {
      return 'Workspace';
    }
    return 'Appointments';
  });
  protected readonly primaryCtaLabel = computed(() => {
    const role = this.authStore.user()?.role;
    return role === 'PROVIDER' ? 'Open workspace' : role === 'ADMIN' ? 'Open admin' : 'Book now';
  });
  protected readonly currentYear = new Date().getFullYear();

  constructor() {
    this.authStore.restoreProfile();
  }

  protected logout(): void {
    this.authStore.clear();
  }
}
