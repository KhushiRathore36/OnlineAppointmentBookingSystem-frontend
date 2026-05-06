import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';

import { AppointmentApiService } from '../core/appointment-api.service';
import { AuthStore } from '../core/auth.store';
import {
  Appointment,
  AvailabilitySlot,
  MedicalRecord,
  Payment,
  Provider,
  ProviderView,
  Review,
  formatTimeRange,
  toProviderView
} from '../core/models';
import { PaymentApiService } from '../core/payment-api.service';
import { ProviderApiService } from '../core/provider-api.service';
import { RecordApiService } from '../core/record-api.service';
import { ReviewApiService } from '../core/review-api.service';
import { ScheduleApiService } from '../core/schedule-api.service';

type ReviewDraft = { rating: number; comment: string; anonymous: boolean };
type RecordDraft = { diagnosis: string; prescription: string; notes: string; followUpDate: string };
type PatientSection = 'overview' | 'upcoming' | 'history' | 'records' | 'payments' | 'reviews';
type ProviderSection = 'setup' | 'overview' | 'profile' | 'slots' | 'today' | 'records' | 'reviews';
type AdminSection = 'overview' | 'providers' | 'analytics' | 'payments';
type DashboardSection = PatientSection | ProviderSection | AdminSection;
type NavItem = { id: DashboardSection; label: string; note: string };

@Component({
  selector: 'app-dashboard-page',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss'
})
export class DashboardPageComponent implements OnInit {
  private readonly authStore = inject(AuthStore);
  private readonly appointmentApi = inject(AppointmentApiService);
  private readonly providerApi = inject(ProviderApiService);
  private readonly reviewApi = inject(ReviewApiService);
  private readonly recordApi = inject(RecordApiService);
  private readonly scheduleApi = inject(ScheduleApiService);
  private readonly paymentApi = inject(PaymentApiService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected appointments: Appointment[] = [];
  protected providers = new Map<number, ProviderView>();
  protected reviews: Review[] = [];
  protected records: MedicalRecord[] = [];
  protected payments: Payment[] = [];
  protected reviewDrafts: Record<number, ReviewDraft> = {};
  protected recordDrafts: Record<number, RecordDraft> = {};
  protected providerProfile: ProviderView | null = null;
  protected providerSlots: AvailabilitySlot[] = [];
  protected providerDirectory: ProviderView[] = [];
  protected adminRevenue = 0;
  protected adminAppointmentCounts: Record<number, number> = {};
  protected state: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  protected actionMessage = '';
  protected providerDate = new Date().toISOString().slice(0, 10);
  protected activeSection: DashboardSection = 'overview';

  protected readonly providerProfileForm = this.fb.nonNullable.group({
    specialization: ['', Validators.required],
    qualification: ['', Validators.required],
    experienceYears: [1, [Validators.required, Validators.min(0)]],
    bio: [''],
    clinicName: ['', Validators.required],
    clinicAddress: ['', Validators.required]
  });

  protected readonly slotForm = this.fb.nonNullable.group({
    startDate: [new Date().toISOString().slice(0, 10), Validators.required],
    endDate: [new Date().toISOString().slice(0, 10), Validators.required],
    startTime: ['09:00', Validators.required],
    endTime: ['17:00', Validators.required],
    durationMinutes: [30, [Validators.required, Validators.min(10)]],
    recurrence: ['DAILY', Validators.required]
  });

  ngOnInit(): void {
    this.loadDashboard();
  }

  protected get user() {
    return this.authStore.user();
  }

  protected get role() {
    return this.user?.role;
  }

  protected get dashboardTitle(): string {
    switch (this.role) {
      case 'PROVIDER':
        return 'Availability, appointments, and provider operations.';
      case 'ADMIN':
        return 'Platform operations, provider verification, and analytics.';
      default:
        return 'Appointments, statuses, payments, and post-visit records.';
    }
  }

  protected get dashboardEyebrow(): string {
    switch (this.role) {
      case 'PROVIDER':
        return 'Provider workspace';
      case 'ADMIN':
        return 'Admin workspace';
      default:
        return 'Patient dashboard';
    }
  }

  protected get sidebarItems(): NavItem[] {
    if (this.role === 'PROVIDER') {
      if (!this.providerProfile) {
        return [
          { id: 'setup', label: 'Setup', note: 'Create your provider profile' }
        ];
      }

      return [
        { id: 'overview', label: 'Overview', note: 'Quick provider summary' },
        { id: 'profile', label: 'Profile', note: 'Clinic and public details' },
        { id: 'slots', label: 'Slots', note: 'Availability and schedule' },
        { id: 'today', label: 'Today', note: 'Appointments for today' },
        { id: 'records', label: 'Records', note: 'Manage patient records' },
        { id: 'reviews', label: 'Reviews', note: 'Patient feedback' }
      ];
    }

    if (this.role === 'ADMIN') {
      return [
        { id: 'overview', label: 'Overview', note: 'Platform snapshot' },
        { id: 'providers', label: 'Providers', note: 'Verification queue' },
        { id: 'analytics', label: 'Analytics', note: 'Approved provider metrics' },
        { id: 'payments', label: 'Payments', note: 'Transaction history' }
      ];
    }

    return [
      { id: 'overview', label: 'Overview', note: 'Your account summary' },
      { id: 'upcoming', label: 'Upcoming', note: 'Scheduled appointments' },
      { id: 'history', label: 'History', note: 'Past appointments' },
      { id: 'records', label: 'Records', note: 'Prescriptions and notes' },
      { id: 'payments', label: 'Payments', note: 'Transaction receipts' },
      { id: 'reviews', label: 'Reviews', note: 'Give feedback on completed visits' }
    ];
  }

  protected get activeNavItem(): NavItem | undefined {
    return this.sidebarItems.find((item) => item.id === this.activeSection);
  }

  protected setActiveSection(section: DashboardSection): void {
    this.activeSection = section;
  }

  protected isActiveSection(section: DashboardSection): boolean {
    return this.activeSection === section;
  }

  protected get upcomingAppointments(): Appointment[] {
    return this.appointments.filter((appointment) => appointment.status === 'SCHEDULED');
  }

  protected get historyAppointments(): Appointment[] {
    return this.appointments.filter((appointment) => appointment.status !== 'SCHEDULED');
  }

  protected get reviewableAppointments(): Appointment[] {
    return this.appointments.filter((appointment) => appointment.status === 'COMPLETED');
  }

  protected get providerTodayAppointments(): Appointment[] {
    const today = new Date().toISOString().slice(0, 10);
    return this.appointments.filter((appointment) => appointment.appointmentDate === today);
  }

  protected get providerUpcomingAppointments(): Appointment[] {
    const today = new Date().toISOString().slice(0, 10);
    return this.appointments
      .filter((appointment) => appointment.appointmentDate >= today)
      .sort((left, right) =>
        `${left.appointmentDate}${left.startTime}`.localeCompare(`${right.appointmentDate}${right.startTime}`)
      );
  }

  protected get providerDaySlots(): AvailabilitySlot[] {
    return this.providerSlots
      .filter((slot) => slot.date === this.providerDate)
      .sort((left, right) => left.startTime.localeCompare(right.startTime));
  }

  protected get adminPendingProviders(): ProviderView[] {
    return this.providerDirectory.filter((provider) => !provider.verified);
  }

  protected get adminVerifiedProviders(): ProviderView[] {
    return this.providerDirectory.filter((provider) => provider.verified);
  }

  protected loadDashboard(): void {
    const user = this.user;
    if (!user) {
      return;
    }

    this.state = 'loading';
    this.actionMessage = '';

    if (user.role === 'PROVIDER') {
      this.loadProviderDashboard(user.userId);
      return;
    }

    if (user.role === 'ADMIN') {
      this.loadAdminDashboard();
      return;
    }

    this.loadPatientDashboard(user.userId);
  }

  protected providerName(providerId: number): string {
    return this.providers.get(providerId)?.displayName || `Provider #${providerId}`;
  }

  protected providerMeta(providerId: number): string {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return 'Loading provider details';
    }
    return `${provider.specialization} - ${provider.clinicName}`;
  }

  protected timeRange(appointment: Appointment): string {
    return formatTimeRange(appointment.startTime, appointment.endTime);
  }

  protected slotRange(slot: AvailabilitySlot): string {
    return formatTimeRange(slot.startTime, slot.endTime);
  }

  protected cancel(appointmentId: number): void {
    this.actionMessage = '';
    this.appointmentApi
      .cancel(appointmentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actionMessage = 'Appointment cancelled and slot released successfully.';
          this.loadDashboard();
        },
        error: () => {
          this.actionMessage = 'Cancellation failed. Please try again in a moment.';
        }
      });
  }

  protected reviewExists(appointmentId: number): boolean {
    return this.reviews.some((review) => review.appointmentId === appointmentId);
  }

  protected canReviewAppointment(appointment: Appointment): boolean {
    return appointment.status === 'COMPLETED' && !this.reviewExists(appointment.appointmentId);
  }

  protected draftFor(appointmentId: number): ReviewDraft {
    if (!this.reviewDrafts[appointmentId]) {
      this.reviewDrafts[appointmentId] = { rating: 5, comment: '', anonymous: false };
    }
    return this.reviewDrafts[appointmentId];
  }

  protected submitReview(appointment: Appointment): void {
    const user = this.user;
    if (!user) {
      return;
    }

    const draft = this.draftFor(appointment.appointmentId);
    this.reviewApi
      .create({
        appointmentId: appointment.appointmentId,
        patientId: user.userId,
        providerId: appointment.providerId,
        rating: draft.rating,
        comment: draft.comment,
        anonymous: draft.anonymous
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actionMessage = 'Review submitted successfully.';
          delete this.reviewDrafts[appointment.appointmentId];
          this.loadDashboard();
        },
        error: (error: HttpErrorResponse) => {
          this.actionMessage =
            error.error?.error
            || error.error?.message
            || 'The review could not be submitted. Please check the appointment status and try again.';
        }
      });
  }

  protected recordExists(appointmentId: number): boolean {
    return this.records.some((record) => record.appointmentId === appointmentId);
  }

  protected recordForAppointment(appointmentId: number): MedicalRecord | undefined {
    return this.records.find((record) => record.appointmentId === appointmentId);
  }

  protected providerRecordDraft(appointment: Appointment): RecordDraft {
    if (!this.recordDrafts[appointment.appointmentId]) {
      const existing = this.recordForAppointment(appointment.appointmentId);
      this.recordDrafts[appointment.appointmentId] = {
        diagnosis: existing?.diagnosis || '',
        prescription: existing?.prescription || '',
        notes: existing?.notes || '',
        followUpDate: existing?.followUpDate || ''
      };
    }
    return this.recordDrafts[appointment.appointmentId];
  }

  protected submitMedicalRecord(appointment: Appointment): void {
    if (!this.providerProfile) {
      return;
    }

    const draft = this.providerRecordDraft(appointment);
    const payload = {
      appointmentId: appointment.appointmentId,
      patientId: appointment.patientId,
      providerId: appointment.providerId,
      diagnosis: draft.diagnosis,
      prescription: draft.prescription,
      notes: draft.notes,
      followUpDate: draft.followUpDate || undefined
    };

    const existing = this.recordForAppointment(appointment.appointmentId);
    const request$ = existing
      ? this.recordApi.update(existing.recordId, payload)
      : this.recordApi.create(payload);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.actionMessage = existing ? 'Medical record updated successfully.' : 'Medical record created successfully.';
        this.loadDashboard();
      },
      error: () => {
        this.actionMessage = 'Medical record could not be saved. Please try again.';
      }
    });
  }

  protected saveProviderProfile(): void {
    const user = this.user;
    if (!user || user.role !== 'PROVIDER' || this.providerProfileForm.invalid) {
      this.providerProfileForm.markAllAsTouched();
      return;
    }

    const payload = {
      userId: user.userId,
      ...this.providerProfileForm.getRawValue()
    };

    const request$ = this.providerProfile
      ? this.providerApi.updateProviderProfile(this.providerProfile.providerId, payload)
      : this.providerApi.createProviderProfile(payload);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.actionMessage = this.providerProfile
          ? 'Provider profile updated successfully.'
          : 'Provider profile submitted. You can now configure slots.';
        this.loadDashboard();
      },
      error: () => {
        this.actionMessage = 'Provider profile could not be saved. Please review the details and try again.';
      }
    });
  }

  protected createSlots(): void {
    if (!this.providerProfile || this.slotForm.invalid) {
      this.slotForm.markAllAsTouched();
      return;
    }

    this.scheduleApi
      .createSlots({
        providerId: this.providerProfile.providerId,
        ...this.slotForm.getRawValue()
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (slots) => {
          this.actionMessage = `${slots.length} slots created for the selected schedule window.`;
          this.providerDate = this.slotForm.getRawValue().startDate;
          this.loadProviderWorkspace(this.providerProfile!.providerId);
        },
        error: () => {
          this.actionMessage = 'Slots could not be created. Please verify the dates and times.';
        }
      });
  }

  protected refreshProviderSlots(): void {
    if (!this.providerProfile) {
      return;
    }

    this.loadProviderWorkspace(this.providerProfile.providerId);
  }

  protected toggleSlotStatus(slot: AvailabilitySlot): void {
    const request$ = slot.status === 'BLOCKED'
      ? this.scheduleApi.releaseSlot(slot.slotId)
      : this.scheduleApi.blockSlot(slot.slotId);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.actionMessage =
          slot.status === 'BLOCKED' ? 'Slot released back to availability.' : 'Slot blocked successfully.';
        this.refreshProviderSlots();
      },
      error: () => {
        this.actionMessage = 'Slot status could not be updated.';
      }
    });
  }

  protected updateProviderAvailability(isAvailable: boolean): void {
    if (!this.providerProfile) {
      return;
    }

    this.providerApi
      .updateAvailability(this.providerProfile.providerId, isAvailable)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actionMessage = isAvailable
            ? 'Provider marked available for bookings.'
            : 'Provider marked unavailable for bookings.';
          this.loadDashboard();
        },
        error: () => {
          this.actionMessage = 'Availability status could not be updated.';
        }
      });
  }

  protected completeAppointment(appointmentId: number): void {
    this.appointmentApi
      .complete(appointmentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actionMessage = 'Appointment marked as completed. Review flow is now unlocked for the patient.';
          this.loadDashboard();
        },
        error: () => {
          this.actionMessage = 'Appointment status could not be updated.';
        }
      });
  }

  protected verifyProvider(providerId: number): void {
    this.providerApi
      .verifyProvider(providerId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actionMessage = 'Provider verified successfully.';
          this.loadDashboard();
        },
        error: () => {
          this.actionMessage = 'Provider verification failed.';
        }
      });
  }

  protected trackedAppointmentCount(providerId: number): number {
    return this.adminAppointmentCounts[providerId] ?? 0;
  }

  protected syncDefaultSection(): void {
    if (this.role === 'PROVIDER' && !this.providerProfile) {
      this.activeSection = 'setup';
      return;
    }

    const validSections = this.sidebarItems.map((item) => item.id);
    if (!validSections.includes(this.activeSection)) {
      this.activeSection = 'overview';
    }
  }

  private loadPatientDashboard(userId: number): void {
    this.syncDefaultSection();
    this.providerApi
      .getProviders()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (providers) => {
          this.providers = new Map(providers.map((provider) => [provider.providerId, toProviderView(provider)]));
        }
      });

    forkJoin({
      appointments: this.appointmentApi.getByPatient(userId),
      reviews: this.reviewApi.getByPatient(userId),
      records: this.recordApi.getByPatient(userId),
      payments: this.paymentApi.getByPatient(userId)
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ appointments, reviews, records, payments }) => {
          this.appointments = appointments;
          this.reviews = reviews;
          this.records = records;
          this.payments = payments;
          this.state = 'ready';
        },
        error: () => {
          this.state = 'error';
        }
      });
  }

  private loadProviderDashboard(userId: number): void {
    this.providerApi
      .getProviders()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (providers) => {
          const mapped = providers.map(toProviderView);
          this.providerDirectory = mapped;
          this.providers = new Map(mapped.map((provider) => [provider.providerId, provider]));
          this.providerProfile = mapped.find((provider) => provider.userId === userId) || null;
          this.syncDefaultSection();

          if (!this.providerProfile) {
            this.state = 'ready';
            return;
          }

          this.providerProfileForm.patchValue({
            specialization: this.providerProfile.specialization,
            qualification: this.providerProfile.qualification,
            experienceYears: this.providerProfile.experienceYears || 1,
            bio: this.providerProfile.bio || '',
            clinicName: this.providerProfile.clinicName,
            clinicAddress: this.providerProfile.clinicAddress
          });

          this.loadProviderWorkspace(this.providerProfile.providerId);
        },
        error: () => {
          this.state = 'error';
        }
      });
  }

  private loadProviderWorkspace(providerId: number): void {
    this.syncDefaultSection();
    forkJoin({
      appointments: this.appointmentApi.getByProvider(providerId),
      reviews: this.reviewApi.getByProvider(providerId),
      records: this.recordApi.getByProvider(providerId),
      slots: this.scheduleApi.getByProvider(providerId)
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ appointments, reviews, records, slots }) => {
          this.appointments = appointments;
          this.reviews = reviews;
          this.records = records;
          this.providerSlots = slots;
          this.state = 'ready';
        },
        error: () => {
          this.state = 'error';
        }
      });
  }

  private loadAdminDashboard(): void {
    this.syncDefaultSection();
    this.providerApi
      .getProviders()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (providers) => {
          const mapped = providers.map(toProviderView);
          this.providerDirectory = mapped;
          this.providers = new Map(mapped.map((provider) => [provider.providerId, provider]));

          const appointmentRequests = mapped.length
            ? forkJoin(
                mapped.map((provider) =>
                  this.appointmentApi.getByProvider(provider.providerId)
                )
              )
            : of([]);

          forkJoin({
            paymentHistory: this.paymentApi.getHistory(),
            revenue: this.paymentApi.getRevenue(),
            appointmentBuckets: appointmentRequests
          })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: ({ paymentHistory, revenue, appointmentBuckets }) => {
                this.payments = paymentHistory;
                this.adminRevenue = revenue;
                this.adminAppointmentCounts = mapped.reduce<Record<number, number>>((accumulator, provider, index) => {
                  accumulator[provider.providerId] = appointmentBuckets[index]?.length || 0;
                  return accumulator;
                }, {});
                this.state = 'ready';
              },
              error: () => {
                this.state = 'error';
              }
            });
        },
        error: () => {
          this.state = 'error';
        }
      });
  }
}
