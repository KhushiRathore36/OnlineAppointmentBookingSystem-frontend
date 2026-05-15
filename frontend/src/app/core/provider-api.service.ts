import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { AvailabilitySlot, Provider, ProviderRequest } from './models';

@Injectable({ providedIn: 'root' })
export class ProviderApiService {
  private readonly http = inject(HttpClient);

  getProviders() {
    return this.http.get<Provider[]>('/api/providers');
  }

  createProviderProfile(payload: ProviderRequest) {
    return this.http.post<Provider>('/api/providers', payload);
  }

  updateProviderProfile(providerId: number, payload: ProviderRequest) {
    return this.http.put<Provider>(`/api/providers/${providerId}`, payload);
  }

  getAvailableSlots(providerId: number, date: string) {
    const params = new HttpParams().set('providerId', providerId).set('date', date);
    return this.http.get<AvailabilitySlot[]>('/api/slots/available', { params });
  }

  verifyProvider(providerId: number) {
    return this.http.put<Provider>(`/api/providers/${providerId}/verify`, {});
  }

  deleteProvider(providerId: number) {
    return this.http.delete(`/api/providers/${providerId}`, { responseType: 'text' });
  }

  updateAvailability(providerId: number, isAvailable: boolean) {
    const params = new HttpParams().set('isAvailable', isAvailable);
    return this.http.put<Provider>(`/api/providers/${providerId}/availability`, {}, { params });
  }
}
