import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { Review, ReviewRequest } from './models';

@Injectable({ providedIn: 'root' })
export class ReviewApiService {
  private readonly http = inject(HttpClient);

  getByProvider(providerId: number) {
    return this.http.get<Review[]>(`/api/reviews/provider/${providerId}`);
  }

  getByPatient(patientId: number) {
    return this.http.get<Review[]>(`/api/reviews/patient/${patientId}`);
  }

  getAll() {
    return this.http.get<Review[]>('/api/reviews');
  }

  create(payload: ReviewRequest) {
    return this.http.post<Review>('/api/reviews', payload);
  }

  delete(reviewId: number) {
    return this.http.delete(`/api/reviews/${reviewId}`, { responseType: 'text' });
  }
}
