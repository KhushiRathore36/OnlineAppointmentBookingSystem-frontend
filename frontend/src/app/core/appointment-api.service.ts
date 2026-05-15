import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { Appointment, AppointmentRequest } from './models';

@Injectable({ providedIn: 'root' })
export class AppointmentApiService {
  private readonly http = inject(HttpClient);

  bookAppointment(payload: AppointmentRequest) {
    return this.http.post<Appointment>('/api/appointments', payload);
  }

  getById(appointmentId: number) {
    return this.http.get<Appointment>(`/api/appointments/${appointmentId}`);
  }

  getAll() {
    return this.http.get<Appointment[]>('/api/appointments');
  }

  getByPatient(patientId: number) {
    return this.http.get<Appointment[]>(`/api/appointments/patient/${patientId}`);
  }

  getByProvider(providerId: number) {
    return this.http.get<Appointment[]>(`/api/appointments/provider/${providerId}`);
  }

  getByProviderAndDate(providerId: number, date: string) {
    return this.http.get<Appointment[]>(`/api/appointments/provider/${providerId}/date/${date}`);
  }

  cancel(appointmentId: number) {
    return this.http.put<Appointment>(`/api/appointments/${appointmentId}/cancel`, {});
  }

  complete(appointmentId: number) {
    return this.http.put<Appointment>(`/api/appointments/${appointmentId}/complete`, {});
  }
}
