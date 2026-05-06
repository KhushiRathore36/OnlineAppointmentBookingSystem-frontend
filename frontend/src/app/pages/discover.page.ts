import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

import { AppointmentApiService } from '../core/appointment-api.service';
import { AuthStore } from '../core/auth.store';
import {
  AvailabilitySlot,
  ProviderView,
  Review,
  formatTimeRange,
  toProviderView
} from '../core/models';
import { ProviderApiService } from '../core/provider-api.service';
import { ReviewApiService } from '../core/review-api.service';
const SERVICE_PRICING: Record<string, number> = {
  'General Consultation': 69900,
  'Follow Up': 49900,
  'Specialist Review': 99900,
  'Video Advice': 79900
};

@Component({
  selector: 'app-discover-page',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './discover.page.html',
  styleUrl: './discover.page.scss'
})
export class DiscoverPageComponent implements OnInit {
  private readonly providerApi = inject(ProviderApiService);
  private readonly appointmentApi = inject(AppointmentApiService);
  private readonly reviewApi = inject(ReviewApiService);
  private readonly authStore = inject(AuthStore);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected providers: ProviderView[] = [];
  protected selectedProvider: ProviderView | null = null;
  protected reviews: Review[] = [];
  protected slots: AvailabilitySlot[] = [];
  protected searchTerm = '';
  protected specialization = 'ALL';
  protected selectedDate = new Date().toISOString().slice(0, 10);
  protected feedback = '';
  protected doctorsState: 'loading' | 'ready' | 'error' = 'loading';
  protected slotsState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  protected bookingState: 'idle' | 'saving' | 'done' | 'error' = 'idle';

  protected readonly bookingForm = this.fb.nonNullable.group({
    serviceType: ['General Consultation', Validators.required],
    modeOfConsultation: ['IN_PERSON', Validators.required],
    notes: ['']
  });

  ngOnInit(): void {
    this.providerApi
      .getProviders()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (providers) => {
          this.providers = providers.map(toProviderView);
          this.doctorsState = 'ready';
          if (this.providers.length) {
            this.selectProvider(this.providers[0]);
          }
        },
        error: () => {
          this.doctorsState = 'error';
        }
      });
  }

  protected get specializationOptions(): string[] {
    return ['ALL', ...new Set(this.providers.map((provider) => provider.specialization).filter(Boolean))];
  }

  protected get filteredProviders(): ProviderView[] {
    return this.providers.filter((provider) => {
      const matchesSearch =
        !this.searchTerm ||
        provider.specialization.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        provider.clinicName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        provider.clinicAddress.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchesSpecialization =
        this.specialization === 'ALL' || provider.specialization === this.specialization;
      return matchesSearch && matchesSpecialization;
    });
  }

  protected selectProvider(provider: ProviderView): void {
    this.selectedProvider = provider;
    this.feedback = '';
    this.loadSlots();
    this.reviewApi
      .getByProvider(provider.providerId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (reviews) => (this.reviews = reviews),
        error: () => (this.reviews = [])
      });
  }

  protected loadSlots(): void {
    if (!this.selectedProvider) {
      return;
    }

    this.slotsState = 'loading';
    this.providerApi
      .getAvailableSlots(this.selectedProvider.providerId, this.selectedDate)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (slots) => {
          this.slots = slots;
          this.slotsState = 'ready';
        },
        error: () => {
          this.slots = [];
          this.slotsState = 'error';
        }
      });
  }

  protected bookSlot(slot: AvailabilitySlot): void {
    void this.startBookingFlow(slot);
  }

  protected get selectedAmountLabel(): string {
    return this.formatCurrency(this.selectedAmountPaise / 100);
  }

  private get selectedAmountPaise(): number {
    const serviceType = this.bookingForm.getRawValue().serviceType;
    return SERVICE_PRICING[serviceType] ?? SERVICE_PRICING['General Consultation'];
  }

  private async startBookingFlow(slot: AvailabilitySlot): Promise<void> {
    const profile = this.authStore.user();

    if (!profile) {
      this.router.navigate(['/auth']);
      return;
    }

    if (profile.role !== 'PATIENT') {
      this.feedback = 'Booking is currently available for patient accounts only.';
      return;
    }

    if (!this.selectedProvider) {
      return;
    }

    this.bookingState = 'saving';
    this.feedback = 'Booking your appointment and preparing payment...';

    try {
      const appointment = await firstValueFrom(
        this.appointmentApi.bookAppointment({
          patientId: profile.userId,
          providerId: this.selectedProvider.providerId,
          slotId: slot.slotId,
          serviceType: this.bookingForm.getRawValue().serviceType,
          notes: this.bookingForm.getRawValue().notes,
          modeOfConsultation: this.bookingForm.getRawValue().modeOfConsultation
        })
      );

      await this.router.navigate(['/checkout'], {
        queryParams: {
          appointmentId: appointment.appointmentId,
          amount: this.selectedAmountPaise,
          providerId: this.selectedProvider.providerId,
          serviceType: this.bookingForm.getRawValue().serviceType
        }
      });
    } catch (error: any) {
      this.bookingState = 'error';
      this.feedback = error?.error?.message || error?.message || 'The booking could not be completed. Please try again.';
      this.loadSlots();
    }
  }

  protected formatRange(slot: AvailabilitySlot): string {
    return formatTimeRange(slot.startTime, slot.endTime);
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount);
  }
}
