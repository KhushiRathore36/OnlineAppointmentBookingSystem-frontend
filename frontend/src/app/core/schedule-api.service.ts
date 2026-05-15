import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { AvailabilitySlot, SlotRequest } from './models';

@Injectable({ providedIn: 'root' })
export class ScheduleApiService {
  private readonly http = inject(HttpClient);

  createSlots(payload: SlotRequest) {
    return this.http.post<AvailabilitySlot[]>('/api/slots', payload);
  }

  getByProvider(providerId: number) {
    return this.http.get<AvailabilitySlot[]>(`/api/slots/provider/${providerId}`);
  }

  blockSlot(slotId: number) {
    return this.http.put<AvailabilitySlot>(`/api/slots/${slotId}/block`, {});
  }

  releaseSlot(slotId: number) {
    return this.http.put<AvailabilitySlot>(`/api/slots/${slotId}/release`, {});
  }
}
