import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { CreateOrderRequest, CreateOrderResponse, Payment, VerifyPaymentRequest } from './models';

@Injectable({ providedIn: 'root' })
export class PaymentApiService {
  private readonly http = inject(HttpClient);

  createOrder(payload: CreateOrderRequest) {
    return this.http.post<CreateOrderResponse>('/api/payments/create-order', payload);
  }

  verifyPayment(payload: VerifyPaymentRequest) {
    return this.http.post<Payment>('/api/payments/verify', payload);
  }

  getByPatient(patientId: number) {
    return this.http.get<Payment[]>(`/api/payments/patient/${patientId}`);
  }

  getHistory() {
    return this.http.get<Payment[]>('/api/payments/history');
  }

  getRevenue() {
    return this.http.get<number>('/api/payments/revenue');
  }

  refund(appointmentId: number, notes: string) {
    return this.http.post<Payment>('/api/payments/refund', { appointmentId, notes });
  }
}
