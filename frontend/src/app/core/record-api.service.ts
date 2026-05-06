import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { MedicalRecord, MedicalRecordRequest } from './models';

@Injectable({ providedIn: 'root' })
export class RecordApiService {
  private readonly http = inject(HttpClient);

  create(payload: MedicalRecordRequest) {
    return this.http.post<MedicalRecord>('/api/records', payload);
  }

  update(recordId: number, payload: MedicalRecordRequest) {
    return this.http.put<MedicalRecord>(`/api/records/${recordId}`, payload);
  }

  getByAppointment(appointmentId: number) {
    return this.http.get<MedicalRecord>(`/api/records/appointment/${appointmentId}`);
  }

  getByPatient(patientId: number) {
    return this.http.get<MedicalRecord[]>(`/api/records/patient/${patientId}`);
  }

  getByProvider(providerId: number) {
    return this.http.get<MedicalRecord[]>(`/api/records/provider/${providerId}`);
  }
}
