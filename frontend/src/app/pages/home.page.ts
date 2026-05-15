import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ProviderApiService } from '../core/provider-api.service';
import { ProviderView, toProviderView } from '../core/models';

@Component({
  selector: 'app-home-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss'
})
export class HomePageComponent implements OnInit {
  private readonly providerApi = inject(ProviderApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly doctors = signal<ProviderView[]>([]);
  protected readonly loadState = signal<'loading' | 'ready' | 'error'>('loading');

  ngOnInit(): void {
    this.providerApi
      .getProviders()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (providers) => {
          this.doctors.set(providers.slice(0, 3).map(toProviderView));
          this.loadState.set('ready');
        },
        error: () => this.loadState.set('error')
      });
  }
}
