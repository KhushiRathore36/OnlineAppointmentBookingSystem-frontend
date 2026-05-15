import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { BulkNotificationRequest, Notification } from './models';

@Injectable({ providedIn: 'root' })
export class NotificationApiService {
  private readonly http = inject(HttpClient);

  getAll() {
    return this.http.get<Notification[]>('/api/notifications');
  }

  sendBulk(payload: BulkNotificationRequest) {
    return this.http.post<Notification[]>('/api/notifications/bulk', payload);
  }
}
